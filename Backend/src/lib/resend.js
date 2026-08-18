import { Resend } from 'resend';
import env from '../config/env.js';
import logger from './logger.js';

const client = new Resend(env.resend.apiKey);

/**
 * Thin transport wrapper. Template rendering lives in src/emails — this file only ships bytes.
 * Email delivery must never break the request it was triggered from, so failures are logged
 * and surfaced as a boolean rather than thrown, except where the caller opts in.
 */
export const sendEmail = async ({ to, subject, html, text, replyTo, tags = [], throwOnError = false }) => {
  try {
    const { data, error } = await client.emails.send({
      from: env.resend.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo: replyTo ?? env.resend.replyTo,
      tags,
    });

    if (error) throw new Error(error.message);
    logger.info('email.sent', { to, subject, id: data?.id });
    return { sent: true, id: data?.id };
  } catch (error) {
    logger.error('email.failed', { to, subject, error: error.message });
    if (throwOnError) throw error;
    return { sent: false, error: error.message };
  }
};

export default { sendEmail };
