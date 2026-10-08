/**
 * Six-digit OTP issuing and verification, delivered by Resend.
 *
 * Guarantees:
 *  - codes are stored only as salted SHA-256 hashes
 *  - one live code per (email, purpose); issuing a new one kills the old
 *  - single use, TTL-bounded, attempt-capped
 *  - a resend cooldown stops the endpoint being used as an email cannon
 *  - verification is constant-time and does not reveal whether the email exists
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  FIXED HERE: the dead-end retry loop.
 *
 *  The code row was written BEFORE the email was sent. When Resend failed, the
 *  request threw — but the row survived, so the cooldown was now armed against
 *  a code the user never received. Their retry hit "Please wait 60 seconds",
 *  and the retry after that did too. Users reported this as verification codes
 *  and password resets simply never working.
 *
 *  Delivery failure now rolls the row back, so retrying is immediate.
 * ──────────────────────────────────────────────────────────────────────────
 */
import otpRepository from '../repositories/otp.repository.js';
import { generateOtp, hashOtp, randomToken, safeEqual } from '../lib/crypto.js';
import { sendTemplate } from './email.service.js';
import { BadRequest, TooManyRequests, Unauthorized } from '../lib/errors.js';
import { OTP_PURPOSE } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';

const TEMPLATE_BY_PURPOSE = {
  [OTP_PURPOSE.SIGNUP]: 'signupOtp',
  [OTP_PURPOSE.LOGIN]: 'loginOtp',
  [OTP_PURPOSE.PASSWORD_RESET]: 'passwordResetOtp',
  [OTP_PURPOSE.EMAIL_CHANGE]: 'signupOtp',
};

const enforceCooldown = async (email, purpose) => {
  const latest = await otpRepository.findLatest(email, purpose);
  if (!latest) return;
  const elapsedSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
  const remaining = Math.ceil(env.otp.resendCooldownSeconds - elapsedSeconds);
  if (remaining > 0) {
    throw TooManyRequests(`Please wait ${remaining} seconds before requesting another code.`, {
      retryAfterSeconds: remaining,
    });
  }
};

export const issueOtp = async ({ email, purpose, name, userId, request }) => {
  await enforceCooldown(email, purpose);
  await otpRepository.invalidateActive(email, purpose);

  const code = generateOtp(env.otp.length);
  const salt = randomToken(16);
  const expiresAt = new Date(Date.now() + env.otp.ttlMinutes * 60_000).toISOString();

  const record = await otpRepository.create({
    email,
    purpose,
    codeHash: hashOtp(code, salt),
    salt,
    expiresAt,
    userId,
    ipAddress: request?.ip,
    userAgent: request?.userAgent,
  });

  const result = await sendTemplate(
    TEMPLATE_BY_PURPOSE[purpose],
    email,
    { name, code, ttlMinutes: env.otp.ttlMinutes, device: request?.userAgent },
    { throwOnError: false },
  );

  /**
   * Delivery failed. Burn the row before throwing, otherwise the cooldown now
   * guards a code that was never delivered and the user's next three attempts
   * are rejected with "please wait" — the reported dead end.
   */
  if (!result.sent) {
    try {
      if (record?.id) await otpRepository.consume(record.id);
    } catch (cleanupError) {
      logger.error('otp.cleanup.failed', { error: cleanupError.message });
    }
    logger.error('otp.delivery.failed', { email, purpose, reason: result.error ?? 'unknown' });
    throw BadRequest('We could not send your verification code right now. Please try again in a moment.');
  }

  logger.info('otp.issued', { purpose, email });
  return { expiresAt, resendAvailableInSeconds: env.otp.resendCooldownSeconds };
};

export const verifyOtp = async ({ email, purpose, code }) => {
  const record = await otpRepository.findActive(email, purpose);

  // Same message whether the record is missing or expired — do not leak account existence.
  if (!record) throw Unauthorized('That code is invalid or has expired. Request a new one.');

  if (record.attempts >= env.otp.maxAttempts) {
    await otpRepository.consume(record.id);
    throw TooManyRequests('Too many incorrect attempts. Please request a new code.');
  }

  const matches = safeEqual(hashOtp(code, record.salt), record.code_hash);
  if (!matches) {
    const attempts = await otpRepository.incrementAttempts(record.id);
    const remaining = Math.max(env.otp.maxAttempts - attempts, 0);
    throw Unauthorized(
      remaining > 0
        ? `That code is not correct. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
    );
  }

  await otpRepository.consume(record.id);
  logger.info('otp.verified', { purpose, email });
  return { userId: record.user_id, verifiedAt: new Date().toISOString() };
};

export default { issueOtp, verifyOtp };
