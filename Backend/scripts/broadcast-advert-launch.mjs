#!/usr/bin/env node
/**
 * One-off broadcast: tell every existing user about the advertising channel.
 *
 *   node scripts/broadcast-advert-launch.mjs --dry-run
 *   node scripts/broadcast-advert-launch.mjs --limit 50 --to you@example.com
 *   node scripts/broadcast-advert-launch.mjs --confirm
 *
 * Why a script and not an endpoint: this sends to the entire user base exactly
 * once. An HTTP route that does that is a route somebody can call twice.
 *
 * Safeguards, in order of how likely each is to save you:
 *
 *  • --confirm is required. Without it the script refuses to send.
 *  • Progress is written to .broadcast-state.json after every batch, so a
 *    crash or a Ctrl-C resumes instead of re-sending to everyone.
 *  • Resend's rate limit is 2 requests/second on the default plan. The pacing
 *    below stays under it; raising BATCH without raising PAUSE will produce
 *    429s and a partial send.
 *  • Suspended and unconfirmed accounts are excluded by the SQL function.
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { advertLaunch } from '../src/emails/templates/advertLaunch.js';
import env from '../src/config/env.js';

const STATE_FILE = path.resolve(process.cwd(), '.broadcast-state.json');
const BATCH = 2;      // emails per tick
const PAUSE = 1_200;  // ms between ticks → ~1.7/sec, under Resend's 2/sec

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};

const DRY_RUN = flag('dry-run');
const CONFIRMED = flag('confirm');
const LIMIT = value('limit') ? Number(value('limit')) : null;
const ONLY = value('to');

const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const resend = new Resend(env.resend.apiKey);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadState = async () => {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { sent: [], failed: [], startedAt: new Date().toISOString() };
  }
};
const saveState = (state) => fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));

const main = async () => {
  if (!DRY_RUN && !CONFIRMED && !ONLY) {
    console.error(
      '\nRefusing to send.\n' +
        '  Preview first:   node scripts/broadcast-advert-launch.mjs --dry-run\n' +
        '  Send to one:     node scripts/broadcast-advert-launch.mjs --to you@example.com\n' +
        '  Send for real:   node scripts/broadcast-advert-launch.mjs --confirm\n',
    );
    process.exit(1);
  }

  // list_user_emails is installed by migration 0001 and is service_role only.
  const { data, error } = await supabase.rpc('list_user_emails', { p_after: null });
  if (error) {
    console.error('Could not load recipients:', error.message);
    console.error('Has migration 0001 been applied?');
    process.exit(1);
  }

  const state = await loadState();
  const alreadySent = new Set(state.sent);

  let recipients = (data ?? []).filter((user) => !alreadySent.has(user.email));
  if (ONLY) recipients = recipients.filter((user) => user.email === ONLY).slice(0, 1);
  if (LIMIT) recipients = recipients.slice(0, LIMIT);

  console.log(`\nRecipients: ${recipients.length}  (already sent: ${alreadySent.size})`);
  console.log(`From: ${env.resend.from}`);
  console.log(`Links point at: ${env.appUrl}`);

  if (env.appUrl.includes('localhost')) {
    console.warn('\n⚠  APP_URL is localhost. Every image and link in this email will be broken.\n');
  }

  if (DRY_RUN) {
    const sample = advertLaunch({ name: recipients[0]?.full_name ?? 'Amina' });
    console.log(`\nSubject: ${sample.subject}`);
    console.log('\n--- plain text ---\n');
    console.log(sample.text);
    await fs.writeFile('broadcast-preview.html', sample.html);
    console.log('\nHTML preview written to broadcast-preview.html');
    console.log('Open it in a browser AND send one to yourself before the real run.\n');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < recipients.length; index += BATCH) {
    const slice = recipients.slice(index, index + BATCH);

    await Promise.all(
      slice.map(async (user) => {
        const { subject, html, text } = advertLaunch({ name: user.full_name });
        try {
          const { error: sendError } = await resend.emails.send({
            from: env.resend.from,
            to: user.email,
            replyTo: env.resend.replyTo,
            subject,
            html,
            text,
            tags: [{ name: 'template', value: 'advertLaunch' }],
          });
          if (sendError) throw new Error(sendError.message);

          state.sent.push(user.email);
          sent += 1;
        } catch (sendError) {
          state.failed.push({ email: user.email, reason: sendError.message });
          failed += 1;
          console.error(`  ✗ ${user.email}: ${sendError.message}`);
        }
      }),
    );

    await saveState(state);
    process.stdout.write(`\r  sent ${sent}  failed ${failed}  of ${recipients.length}`);
    await sleep(PAUSE);
  }

  console.log(`\n\nDone. Sent ${sent}, failed ${failed}.`);
  if (failed) console.log(`Failures are listed in ${STATE_FILE}. Re-run to retry only those.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
