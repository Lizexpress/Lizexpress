import rateLimit from 'express-rate-limit';
import { TooManyRequests } from '../lib/errors.js';
import { clientIp } from '../lib/clientIp.js';

/** Limits are keyed on the real client IP, not the proxy address. */
const keyGenerator = (req) => clientIp(req);

const build = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(TooManyRequests(message)),
  });

/** Generic ceiling for the whole API. */
export const globalLimiter = build({
  windowMs: 60_000,
  max: 120,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Credential endpoints — deliberately tight. */
export const authLimiter = build({
  windowMs: 15 * 60_000,
  max: 10,
  message: 'Too many attempts. Please wait 15 minutes before trying again.',
});

/** OTP request/verify — tighter still, because each one costs an email. */
export const otpLimiter = build({
  windowMs: 10 * 60_000,
  max: 6,
  message: 'Too many verification code requests. Please wait a few minutes.',
});

export const uploadLimiter = build({
  windowMs: 60_000,
  max: 20,
  message: 'Too many uploads in a short time. Please wait a moment.',
});
