/**
 * Launch announcement for the advertising channel.
 *
 * Appended to emails/templates/index.js with:
 *     export { advertLaunch } from './advertLaunch.js';
 *
 * Written for people who already use LizExpress to swap. It therefore leads
 * with what is NEW and states plainly that swapping is unchanged — the most
 * common reaction to a product email like this is "has my account changed?",
 * and leaving that unanswered generates support load.
 */
import env from '../../config/env.js';
import { renderLayout, toPlainText, button, notice, BRAND, MONO_STACK } from '../layout.js';

const firstName = (name) => (name ? String(name).trim().split(/\s+/)[0] : 'there');
const p = (text) => `<p style="margin:0 0 16px;">${text}</p>`;
const strong = (text) => `<strong style="color:${BRAND.ink};font-weight:600;">${text}</strong>`;

/** Numbered steps. Tables, because Outlook ignores list styling. */
const steps = (items) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
    ${items
      .map(
        (item, index) => `
    <tr>
      <td width="32" valign="top" style="padding:0 12px 16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" height="28" align="center" valign="middle"
                bgcolor="${BRAND.purpleTint}"
                style="border-radius:14px;font-family:${MONO_STACK};
                       font-size:13px;font-weight:600;color:${BRAND.purple};">${index + 1}</td>
          </tr>
        </table>
      </td>
      <td valign="top" style="padding:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.body};">
        ${item}
      </td>
    </tr>`,
      )
      .join('')}
  </table>`;

export const advertLaunch = ({ name } = {}) => ({
  subject: 'New on LizExpress: advertise your business to customers near you',

  html: renderLayout({
    preheader: 'Put your products and services in front of customers in your own state and LGA — ₦1,000 per photo.',
    eyebrow: 'New feature',
    heading: `${firstName(name)}, you can now advertise on LizExpress`,
    body:
      p(
        `Until now LizExpress did one thing: swapping. Today we are adding a second — ${strong(
          'paid advertisements',
        )} for vendors, shops and service providers.`,
      ) +
      p(
        `If you sell anything — food, fabric, phone repairs, catering, tailoring, building materials — you can now put it in front of people searching in ${strong(
          'your own state, city and local government area',
        )}.`,
      ) +

      `<h2 style="margin:32px 0 16px;font-family:Archivo,'Segoe UI',Arial,sans-serif;font-size:18px;
                  font-weight:600;color:${BRAND.ink};letter-spacing:-0.01em;">How it works</h2>` +

      steps([
        `Open your dashboard and choose ${strong('Advertise')}. You can do this alongside swapping — you do not have to pick one.`,
        `Add your business details and the area you serve: state, city and LGA.`,
        `Upload photos of what you offer. Each photo costs ${strong('₦1,000')}.`,
        `Pay once and your advert goes live for 30 days. Customers nearby can find you, see your work and call you directly.`,
      ]) +

      notice(
        'Your swapping account is unchanged. Your listings, chats and saved items all stay exactly as they are — advertising is simply a second thing you can switch on.',
        'neutral',
      ) +

      button('Create your first advert', `${env.appUrl}/dashboard/adverts/new`) +

      p(
        `You can also just ${strong('browse')} — if you are looking for a supplier or a service near you, search adverts by location and see photos before you call.`,
      ) +
      p(
        `<a href="${env.appUrl}/adverts" style="color:${BRAND.purple};font-weight:600;text-decoration:underline;">Browse adverts near you →</a>`,
      ),

    footNote:
      'You are receiving this because you have a LizExpress account. Reply to this email if you have any questions — a person reads it.',
  }),

  text: toPlainText([
    `${firstName(name)}, you can now advertise on LizExpress.`,
    'Until now LizExpress did one thing: swapping. We are adding a second — paid advertisements for vendors, shops and service providers.',
    'If you sell anything, you can now put it in front of people searching in your own state, city and local government area.',
    'How it works:',
    '1. Open your dashboard and choose Advertise. You can do this alongside swapping.',
    '2. Add your business details and the area you serve: state, city and LGA.',
    '3. Upload photos of what you offer. Each photo costs N1,000.',
    '4. Pay once and your advert goes live for 30 days.',
    'Your swapping account is unchanged. Listings, chats and saved items stay exactly as they are.',
    `Create your first advert: ${env.appUrl}/dashboard/adverts/new`,
    `Browse adverts near you: ${env.appUrl}/adverts`,
    'You are receiving this because you have a LizExpress account.',
  ]),
});

export default advertLaunch;
