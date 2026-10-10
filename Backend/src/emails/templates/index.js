/**
 * Every transactional email the platform sends.
 * Each template returns { subject, html, text } — nothing else in the codebase
 * builds email markup, so branding stays consistent by construction.
 */
import env from '../../config/env.js';
import { renderLayout, toPlainText, button, otpBlock, detailTable, notice, BRAND } from '../layout.js';

const money = (amount, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(amount || 0),
  );

/** Admin console lives under /admin on the admin host; ADMIN_URL may or may not include it. */
const adminLink = (path) => {
  const base = String(env.adminUrl || '').replace(/\/$/, '');
  return `${/\/admin$/.test(base) ? base : `${base}/admin`}${path}`;
};

const firstName = (name) => (name ? String(name).trim().split(/\s+/)[0] : 'there');

const p = (text) => `<p style="margin:0 0 16px;">${text}</p>`;
const strong = (text) => `<strong style="color:${BRAND.ink};font-weight:600;">${text}</strong>`;

/* ─────────────────── Authentication ─────────────────── */

export const signupOtp = ({ name, code, ttlMinutes }) => ({
  subject: `${code} is your LizExpress verification code`,
  html: renderLayout({
    preheader: `Your code is ${code}. It expires in ${ttlMinutes} minutes.`,
    eyebrow: 'Verify your email',
    heading: `Welcome to LizExpress, ${firstName(name)}`,
    body:
      p('You are one step away from swapping. Enter the code below in the app to confirm your email address.') +
      otpBlock(code, ttlMinutes) +
      p(`If you did not create a LizExpress account, you can safely ignore this email — no account will be activated without this code.`),
    footNote: 'Never share this code. LizExpress staff will never ask you for it.',
  }),
  text: toPlainText([
    `Welcome to LizExpress, ${firstName(name)}.`,
    `Your verification code is: ${code}`,
    `It expires in ${ttlMinutes} minutes and can only be used once.`,
    'If you did not sign up, ignore this email.',
  ]),
});

export const loginOtp = ({ name, code, ttlMinutes, device }) => ({
  subject: `${code} is your LizExpress sign-in code`,
  html: renderLayout({
    preheader: `Your sign-in code is ${code}.`,
    eyebrow: 'Sign in',
    heading: 'Confirm it is you',
    body:
      p(`Hi ${firstName(name)}, use this code to finish signing in.`) +
      otpBlock(code, ttlMinutes) +
      (device ? notice(`Request came from ${device}. If this was not you, change your password immediately.`, 'warning') : ''),
    footNote: 'Never share this code with anyone.',
  }),
  text: toPlainText([`Your LizExpress sign-in code is: ${code}`, `Expires in ${ttlMinutes} minutes.`]),
});

export const passwordResetOtp = ({ name, code, ttlMinutes }) => ({
  subject: `${code} is your LizExpress password reset code`,
  html: renderLayout({
    preheader: `Reset code: ${code}. Expires in ${ttlMinutes} minutes.`,
    eyebrow: 'Password reset',
    heading: 'Reset your password',
    body:
      p(`Hi ${firstName(name)}, we received a request to reset your LizExpress password. Enter this code to continue.`) +
      otpBlock(code, ttlMinutes) +
      notice('If you did not request this, your password has not changed and no action is needed.', 'neutral'),
  }),
  text: toPlainText([`Your password reset code is: ${code}`, `Expires in ${ttlMinutes} minutes.`]),
});

export const passwordChanged = ({ name, changedAt, ip }) => ({
  subject: 'Your LizExpress password was changed',
  html: renderLayout({
    preheader: 'Your password was changed just now.',
    eyebrow: 'Security',
    heading: 'Your password was changed',
    body:
      p(`Hi ${firstName(name)}, this is a confirmation that your LizExpress password was changed successfully.`) +
      detailTable([
        ['When', new Date(changedAt).toUTCString()],
        ['IP address', ip || 'Unknown'],
      ]) +
      notice(
        `If this was not you, reset your password now and contact <a href="mailto:${env.resend.replyTo}" style="color:inherit;">${env.resend.replyTo}</a>.`,
        'danger',
      ) +
      button('Go to your account', `${env.appUrl}/settings`, 'secondary'),
  }),
  text: toPlainText(['Your LizExpress password was changed.', 'If this was not you, reset it immediately.']),
});

export const welcome = ({ name }) => ({
  subject: 'Welcome to LizExpress — here is how to get your first swap',
  html: renderLayout({
    preheader: 'Your account is live. Three steps to your first swap.',
    eyebrow: 'You are in',
    heading: `Welcome aboard, ${firstName(name)}`,
    body:
      p('Your email is confirmed and your account is live. Here is the quickest path to your first successful swap:') +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 4px;">
        ${[
          ['1', 'Complete your profile', 'Add your location and photo so swappers know who they are dealing with.'],
          ['2', 'Verify your identity', 'A quick ID check unlocks listing and messaging. Most reviews finish within 24 hours.'],
          ['3', 'List what you no longer need', 'Say what you want in return, and let the matches come to you.'],
        ]
          .map(
            ([num, title, copy]) => `<tr>
              <td width="38" valign="top" style="padding:0 0 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr><td width="28" height="28" align="center" bgcolor="${BRAND.orangeTint}"
                      style="border-radius:14px;font-family:Arial,sans-serif;font-size:13px;
                             font-weight:600;color:${BRAND.purple};">${num}</td></tr>
                </table>
              </td>
              <td valign="top" style="padding:0 0 18px;">
                <p style="margin:0 0 3px;font-size:16px;font-weight:600;color:${BRAND.ink};">${title}</p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.body};">${copy}</p>
              </td>
            </tr>`,
          )
          .join('')}
      </table>` +
      button('Start your first listing', `${env.appUrl}/list-item`),
  }),
  text: toPlainText([
    `Welcome to LizExpress, ${firstName(name)}.`,
    '1. Complete your profile  2. Verify your identity  3. List an item',
    `${env.appUrl}/list-item`,
  ]),
});

/* ─────────────────── Verification / KYC ─────────────────── */

export const verificationSubmitted = ({ name, reference }) => ({
  subject: 'We received your verification documents',
  html: renderLayout({
    preheader: 'Your documents are queued for review.',
    eyebrow: 'Verification',
    heading: 'Documents received',
    body:
      p(`Thanks ${firstName(name)} — your documents are in the review queue. Our team checks submissions manually, and most are completed within 24 hours.`) +
      detailTable([
        ['Reference', reference],
        ['Submitted', new Date().toUTCString()],
        ['Status', 'Pending review'],
      ]) +
      p('We will email you the moment a decision is made. No action is needed from you right now.'),
  }),
  text: toPlainText(['We received your verification documents.', `Reference: ${reference}`, 'Most reviews finish within 24 hours.']),
});

export const verificationApproved = ({ name }) => ({
  subject: 'You are verified on LizExpress',
  html: renderLayout({
    preheader: 'Your identity check passed. Listing is now unlocked.',
    eyebrow: 'Approved',
    heading: 'Your identity is verified',
    body:
      p(`Good news, ${firstName(name)} — your documents passed review. Your profile now carries a verified badge, which makes other swappers far more likely to trade with you.`) +
      p(`You can now ${strong('list items')}, ${strong('message swappers')}, and ${strong('accept swap offers')}.`) +
      button('List your first item', `${env.appUrl}/list-item`),
  }),
  text: toPlainText(['Your LizExpress identity verification was approved.', 'You can now list items and message swappers.']),
});

export const verificationRejected = ({ name, reason, notes }) => ({
  subject: 'Action needed on your verification',
  html: renderLayout({
    preheader: 'We could not approve your documents yet.',
    eyebrow: 'Action needed',
    heading: 'We need a clearer submission',
    body:
      p(`Hi ${firstName(name)}, our team reviewed your documents but could not approve them yet.`) +
      notice(`<strong>Reason:</strong> ${reason}${notes ? `<br /><br />${notes}` : ''}`, 'warning') +
      p('This is usually quick to fix. Re-upload with the document flat, fully in frame, well lit, and with all four corners visible.') +
      button('Resubmit documents', `${env.appUrl}/id-verification`),
    footNote: `Questions? Reply to this email or write to ${env.resend.replyTo}.`,
  }),
  text: toPlainText([`Your verification could not be approved. Reason: ${reason}`, notes, `Resubmit: ${env.appUrl}/id-verification`]),
});

/* ─────────────────── Payments ─────────────────── */

export const paymentReceipt = ({ name, amount, currency, reference, itemName, method, paidAt }) => ({
  subject: `Receipt for your listing fee — ${money(amount, currency)}`,
  html: renderLayout({
    preheader: `Payment of ${money(amount, currency)} confirmed.`,
    eyebrow: 'Receipt',
    heading: 'Payment confirmed',
    body:
      p(`Thanks ${firstName(name)}, your listing fee has been received and ${strong(itemName)} is now live on LizExpress.`) +
      detailTable([
        ['Item', itemName],
        ['Amount', money(amount, currency)],
        ['Method', method || 'Card'],
        ['Reference', reference],
        ['Date', new Date(paidAt).toUTCString()],
      ]) +
      button('View your listing', `${env.appUrl}/dashboard/listings`) +
      p(`<span style="font-size:13px;color:${BRAND.muted};">Keep this email as your receipt. Refunds are governed by our <a href="${env.appUrl}/refund-policy" style="color:${BRAND.purple};">refund policy</a>.</span>`),
  }),
  text: toPlainText([`Payment confirmed: ${money(amount, currency)}`, `Item: ${itemName}`, `Reference: ${reference}`]),
});

export const paymentFailed = ({ name, amount, currency, reference, reason, isAdvert }) => ({
  subject: isAdvert ? 'Your advert payment did not go through' : 'Your listing payment did not go through',
  html: renderLayout({
    preheader: 'The payment failed and your item is still unpublished.',
    eyebrow: 'Payment failed',
    heading: 'That payment did not complete',
    body:
      p(`Hi ${firstName(name)}, we could not process your ${isAdvert ? 'advert payment' : 'listing fee'} of ${strong(money(amount, currency))}.`) +
      (reason ? notice(`<strong>Reason given by the bank:</strong> ${reason}`, 'danger') : '') +
      p(`Your ${isAdvert ? 'advert' : 'item'} is saved as a draft, so nothing was lost. You have not been charged.`) +
      button('Try payment again', `${env.appUrl}/dashboard/${isAdvert ? 'adverts' : 'listings'}`),
    footNote: `Reference: ${reference}`,
  }),
  text: toPlainText([`Payment of ${money(amount, currency)} failed.`, `Reference: ${reference}`, 'Your item is saved as a draft.']),
});

/* ─────────────────── Advertising ─────────────────── */

const photoLine = (count) => `${count} photo${Number(count) === 1 ? '' : 's'}`;

/**
 * Receipt for an advert payment. `live` says whether the advert went straight
 * up (auto-approve on) or is waiting for a quick check by the team.
 */
export const advertPaymentReceipt = ({
  name, amount, currency, reference, advertTitle, businessName, photoCount, method, paidAt, live, durationDays,
}) => ({
  subject: `Receipt: ${money(amount, currency)} for your LizExpress advert`,
  html: renderLayout({
    preheader: live ? 'Payment received. Your advert is live.' : 'Payment received. Your advert will appear on the adverts page shortly.',
    eyebrow: 'Receipt',
    heading: 'Payment received',
    body:
      p(`Thanks ${firstName(name)}, we have received your payment for ${strong(advertTitle)}.`) +
      (live
        ? p(`Your advert is now live on the adverts page and will run for ${durationDays} days.`)
        : notice('Your advert will appear on the adverts page shortly. Our team gives every new advert a quick check first, usually within a few hours. We will email you the moment it is live.', 'neutral')) +
      detailTable([
        ['Advert', advertTitle],
        ...(businessName ? [['Business', businessName]] : []),
        ['Photos paid for', photoLine(photoCount ?? 1)],
        ['Amount', money(amount, currency)],
        ['Method', String(method || 'Card').replace(/_/g, ' ')],
        ['Reference', reference],
        ['Date', new Date(paidAt || Date.now()).toUTCString()],
      ]) +
      button('View my adverts', `${env.appUrl}/dashboard/adverts`) +
      p(`<span style="font-size:13px;color:${BRAND.muted};">Keep this email as your receipt. Refunds are governed by our <a href="${env.appUrl}/refund-policy" style="color:${BRAND.purple};">refund policy</a>.</span>`),
  }),
  text: toPlainText([
    `Payment received: ${money(amount, currency)}`,
    `Advert: ${advertTitle}`,
    `Reference: ${reference}`,
    live ? 'Your advert is live.' : 'Your advert will appear on the adverts page shortly, after a quick check by our team.',
  ]),
});

export const advertApproved = ({ name, advertTitle, advertId, expiresAt }) => ({
  subject: `Your advert "${advertTitle}" is live`,
  html: renderLayout({
    preheader: 'Customers can now see your advert.',
    eyebrow: 'Advert live',
    heading: 'Your advert is live',
    body:
      p(`Good news, ${firstName(name)}. ${strong(advertTitle)} passed review and customers near you can now see it on the adverts page.`) +
      (expiresAt ? detailTable([['Runs until', new Date(expiresAt).toDateString()]]) : '') +
      button('See your advert', `${env.appUrl}/adverts/${advertId}`) +
      p(`<span style="font-size:13px;color:${BRAND.muted};">Tip: share the link on WhatsApp and your other channels. Adverts with shares get noticeably more calls.</span>`),
  }),
  text: toPlainText([`Your advert "${advertTitle}" is live.`, `${env.appUrl}/adverts/${advertId}`]),
});

/** Used both when a new advert is not approved and when a live one is paused. */
export const advertSuspended = ({ name, advertTitle, advertId, reason, wasLive }) => ({
  subject: wasLive ? `Your advert "${advertTitle}" was paused` : `Your advert "${advertTitle}" needs changes`,
  html: renderLayout({
    preheader: wasLive ? 'An administrator paused your advert.' : 'Your advert could not be approved yet.',
    eyebrow: wasLive ? 'Advert paused' : 'Advert not approved',
    heading: wasLive ? 'Your advert was paused' : 'Your advert needs changes',
    body:
      p(
        wasLive
          ? `Hi ${firstName(name)}, our team paused ${strong(advertTitle)}, so it is no longer shown on the adverts page.`
          : `Hi ${firstName(name)}, our team reviewed ${strong(advertTitle)} but could not approve it yet.`,
      ) +
      (reason ? notice(`<strong>Reason:</strong> ${reason}`, 'warning') : '') +
      p('Reply to this email or contact support and we will help you sort it out. Your payment is kept on record against this advert.') +
      button('Open the advert', `${env.appUrl}/dashboard/adverts/${advertId}`),
  }),
  text: toPlainText([
    wasLive ? `Your advert "${advertTitle}" was paused.` : `Your advert "${advertTitle}" could not be approved yet.`,
    reason ? `Reason: ${reason}` : '',
    'Reply to this email for help.',
  ]),
});

export const advertExpired = ({ name, advertTitle, advertId, renewAmount }) => ({
  subject: `Your advert "${advertTitle}" has ended. Renew it?`,
  html: renderLayout({
    preheader: 'Your month is up. Renew to put it back on the adverts page.',
    eyebrow: 'Advert ended',
    heading: 'Your advert has finished its month',
    body:
      p(`Hi ${firstName(name)}, ${strong(advertTitle)} has run for its full month and is no longer shown on the adverts page.`) +
      p('Nothing is lost. Your photos, details, likes and comments are kept, and you can put it back up for another month in one step.') +
      (renewAmount ? detailTable([['Renewal', `${money(renewAmount)} for 30 more days`]]) : '') +
      button('Renew my advert', `${env.appUrl}/dashboard/adverts/${advertId}?step=publish`),
  }),
  text: toPlainText([
    `Your advert "${advertTitle}" has ended.`,
    `Renew it: ${env.appUrl}/dashboard/adverts/${advertId}?step=publish`,
  ]),
});

export const adminAdvertReview = ({ advertTitle, businessName, ownerName, amount, currency, location, advertId }) => ({
  subject: `New paid advert to approve: ${advertTitle}`,
  html: renderLayout({
    preheader: `${businessName || ownerName} paid ${money(amount, currency)}.`,
    eyebrow: 'Admin',
    heading: 'An advert is waiting for approval',
    body:
      p('A customer has paid for an advert. It goes live once someone approves it.') +
      detailTable([
        ['Advert', advertTitle],
        ['Business', businessName || '—'],
        ['Advertiser', ownerName || '—'],
        ['Location', location || '—'],
        ['Paid', money(amount, currency)],
      ]) +
      button('Review adverts', adminLink(`/adverts?status=pending_review&open=${advertId}`), 'secondary'),
  }),
  text: toPlainText([`New paid advert to approve: ${advertTitle}`, adminLink('/adverts')]),
});

/* ─────────────────── Marketplace activity ─────────────────── */

export const itemPublished = ({ name, itemName, itemId }) => ({
  subject: `${itemName} is now live`,
  html: renderLayout({
    preheader: 'Your listing is visible to swappers.',
    eyebrow: 'Listing live',
    heading: 'Your item is live',
    body:
      p(`${firstName(name)}, ${strong(itemName)} is now visible to everyone browsing LizExpress.`) +
      p('Listings with clear photos and an honest condition note get roughly three times more swap offers.') +
      button('View listing', `${env.appUrl}/items/${itemId}`),
  }),
  text: toPlainText([`${itemName} is now live on LizExpress.`, `${env.appUrl}/items/${itemId}`]),
});

export const newMessage = ({ name, senderName, itemName, preview, chatId }) => ({
  subject: `${senderName} sent you a message about ${itemName}`,
  html: renderLayout({
    preheader: preview,
    eyebrow: 'New message',
    heading: `${senderName} is interested`,
    body:
      p(`Hi ${firstName(name)}, you have a new message about ${strong(itemName)}.`) +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0;">
        <tr><td bgcolor="${BRAND.purpleTint}" style="border-radius:12px;padding:18px 20px;
            font-size:15px;line-height:1.6;color:${BRAND.ink};font-style:italic;">"${preview}"</td></tr>
      </table>` +
      button('Reply now', `${env.appUrl}/chats/${chatId}`),
    footNote: 'Keep conversations and payments on LizExpress. We cannot help with deals arranged off-platform.',
  }),
  text: toPlainText([`${senderName} sent you a message about ${itemName}.`, `"${preview}"`, `${env.appUrl}/chats/${chatId}`]),
});

export const swapOffer = ({ name, offerBy, yourItem, offeredItem, chatId }) => ({
  subject: `Swap offer: ${offeredItem} for your ${yourItem}`,
  html: renderLayout({
    preheader: `${offerBy} wants to swap ${offeredItem} for your ${yourItem}.`,
    eyebrow: 'Swap offer',
    heading: 'You have a swap offer',
    body:
      p(`${firstName(name)}, ${strong(offerBy)} would like to swap ${strong(offeredItem)} for your ${strong(yourItem)}.`) +
      button('Review the offer', `${env.appUrl}/chats/${chatId}`),
  }),
  text: toPlainText([`${offerBy} offered ${offeredItem} for your ${yourItem}.`, `${env.appUrl}/chats/${chatId}`]),
});

export const accountSuspended = ({ name, reason }) => ({
  subject: 'Your LizExpress account has been suspended',
  html: renderLayout({
    preheader: 'Your account access has been restricted.',
    eyebrow: 'Account notice',
    heading: 'Your account has been suspended',
    body:
      p(`Hi ${firstName(name)}, your LizExpress account has been suspended following a review of activity on the platform.`) +
      notice(`<strong>Reason:</strong> ${reason}`, 'danger') +
      p(`If you believe this is a mistake, reply to this email or write to ${env.resend.replyTo} and our team will look again.`),
  }),
  text: toPlainText(['Your LizExpress account has been suspended.', `Reason: ${reason}`]),
});

/* ─────────────────── Admin-facing ─────────────────── */

export const adminVerificationQueue = ({ pendingCount, oldestWaitingHours }) => ({
  subject: `${pendingCount} verification${pendingCount === 1 ? '' : 's'} awaiting review`,
  html: renderLayout({
    preheader: `${pendingCount} pending in the queue.`,
    eyebrow: 'Admin digest',
    heading: 'Verification queue needs attention',
    body:
      detailTable([
        ['Pending submissions', String(pendingCount)],
        ['Longest wait', `${oldestWaitingHours} hours`],
      ]) + button('Open review queue', adminLink('/verifications'), 'secondary'),
  }),
  text: toPlainText([`${pendingCount} verifications pending. Oldest waiting ${oldestWaitingHours}h.`]),
});

export const adminInvite = ({ name, role, inviteUrl, invitedBy }) => ({
  subject: 'You have been invited to the LizExpress admin console',
  html: renderLayout({
    preheader: 'Set up your admin access.',
    eyebrow: 'Admin invitation',
    heading: 'Set up your admin access',
    body:
      p(`Hi ${firstName(name)}, ${strong(invitedBy)} invited you to the LizExpress admin console as ${strong(role.replace('_', ' '))}.`) +
      button('Accept invitation', inviteUrl, 'secondary') +
      notice('This invitation expires in 48 hours and can only be used once.', 'warning'),
  }),
  text: toPlainText([`You were invited to the LizExpress admin console as ${role}.`, inviteUrl]),
});

export { advertLaunch } from './advertLaunch.js';
import { advertLaunch } from './advertLaunch.js';

export default {
  advertLaunch,
  signupOtp,
  loginOtp,
  passwordResetOtp,
  passwordChanged,
  welcome,
  verificationSubmitted,
  verificationApproved,
  verificationRejected,
  paymentReceipt,
  paymentFailed,
  advertPaymentReceipt,
  advertApproved,
  advertSuspended,
  advertExpired,
  adminAdvertReview,
  itemPublished,
  newMessage,
  swapOffer,
  accountSuspended,
  adminVerificationQueue,
  adminInvite,
};
