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

export const sendTemplate = async (templateName, to, props = {}, options = {}) => {
  warnIfUnreachableAssets();
  const template = templates[templateName];
  if (!template) throw new Error(`Unknown email template: ${templateName}`);

  const { subject, html, text } = template(props);
  return sendEmail({ to, subject, html, text, tags: [{ name: 'template', value: templateName }], ...options });
};

/**
 * Fire-and-forget. Used for notification emails where the user's request
 * should not wait on — or fail because of — an email provider.
 */
export const queueTemplate = (templateName, to, props = {}) => {
  sendTemplate(templateName, to, props).catch((error) =>
    logger.error('email.queue.failed', { templateName, to, error: error.message }),
  );
};

export default { sendTemplate, queueTemplate };
