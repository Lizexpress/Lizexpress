/**
 * Application-facing email API.
 * Services call sendTemplate('welcome', to, props) — they never build markup
 * and never talk to Resend directly.
 */
import { sendEmail } from '../lib/resend.js';
import templates from '../emails/templates/index.js';
import logger from '../lib/logger.js';

export const sendTemplate = async (templateName, to, props = {}, options = {}) => {
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
