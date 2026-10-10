/**
 * Application-facing email API.
 * Services call sendTemplate('welcome', to, props) — they never build markup
 * and never talk to Resend directly.
 */
import { sendEmail } from '../lib/resend.js';
import templates from '../emails/templates/index.js';
import logger from '../lib/logger.js';
import env from '../config/env.js';

/**
 * Email images are fetched by the recipient's mail provider over the public
 * internet, not by the sender. If APP_URL points at localhost or a private
 * address, Gmail and Outlook simply cannot reach it, and every logo and icon
 * renders broken — which looks identical to a missing asset.
 *
 * Warned once at first send rather than per email, so local development is not
 * drowned in log noise.
 */
let assetHostWarned = false;
const warnIfUnreachableAssets = () => {
  if (assetHostWarned) return;
  assetHostWarned = true;

  const url = env.appUrl ?? '';
  const isPrivate = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|\[::1\])/i.test(url);
  if (isPrivate) {
    logger.warn({
      message: 'email.assets.unreachable',
      appUrl: url,
      detail:
        'APP_URL is a local address, so images in emails will appear broken in real inboxes. ' +
        'Set APP_URL to the deployed https origin (e.g. https://lizexpressltd.com) to test them.',
    });
  } else if (url.startsWith('http://')) {
    logger.warn({
      message: 'email.assets.insecure',
      appUrl: url,
      detail: 'APP_URL is http. Many mail clients refuse to load non-https images.',
    });
  }
};

/**
 * Names, item titles, chat previews and reasons are typed by users. They are
 * escaped before they touch HTML: one account already uses a <script>-style
 * payload as its display name. Subject and plain-text versions use the raw
 * values, because escaping there would show "&amp;" to the reader.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const escapeProps = (props) =>
  Object.fromEntries(
    Object.entries(props ?? {}).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]),
  );

export const renderTemplate = (templateName, props = {}) => {
  const template = templates[templateName];
  if (!template) throw new Error(`Unknown email template: ${templateName}`);
  const { subject, text } = template(props);
  const { html } = template(escapeProps(props));
  // Subjects are a single header line; strip anything that could break it.
  return { subject: String(subject).replace(/[\r\n<>]+/g, ' ').trim(), html, text };
};

export const sendTemplate = async (templateName, to, props = {}, options = {}) => {
  warnIfUnreachableAssets();
  const { subject, html, text } = renderTemplate(templateName, props);
  return sendEmail({ to, subject, html, text, tags: [{ name: 'template', value: templateName }], ...options });
};

/**
 * On Vercel a function can be frozen as soon as the response is sent, taking
 * an un-awaited email with it. Registering the send with the platform's
 * request context keeps the function alive until it finishes. Elsewhere
 * (local, a long-running server) this is a no-op and the promise just runs.
 */
const keepAlive = (promise) => {
  try {
    const context = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    context?.waitUntil?.(promise);
  } catch {
    /* not on Vercel */
  }
  return promise;
};

/**
 * Fire-and-forget. Used for notification emails where the user's request
 * should not wait on — or fail because of — an email provider.
 */
export const queueTemplate = (templateName, to, props = {}) =>
  keepAlive(
    sendTemplate(templateName, to, props).catch((error) =>
      logger.error('email.queue.failed', { templateName, to, error: error.message }),
    ),
  );

/** Awaited, never throws. For receipts, where the request may end right after. */
export const deliverTemplate = async (templateName, to, props = {}) => {
  if (!to) return false;
  try {
    await sendTemplate(templateName, to, props);
    return true;
  } catch (error) {
    logger.error('email.send.failed', { templateName, to, error: error.message });
    return false;
  }
};

export default { sendTemplate, queueTemplate, deliverTemplate, renderTemplate, escapeHtml };
