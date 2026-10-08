/**
 * Rate limiting.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  WHY THIS WAS REWRITTEN
 *
 *  Every limiter keyed purely on client IP. Most Nigerian mobile traffic
 *  arrives through carrier-grade NAT, so thousands of MTN or Airtel
 *  subscribers share a handful of public addresses. With authLimiter at
 *  10 requests per 15 minutes per IP, ten failed sign-ins anywhere on a
 *  carrier locked out every other user behind the same address — which is
 *  exactly what "I can't sign in" looks like from the outside, with no error
 *  in the logs beyond a 429.
 *
 *  The fix is to key credential endpoints on the ACCOUNT being targeted
 *  (the submitted email) with a wider, secondary IP ceiling behind it. That
 *  still stops credential stuffing against one account, and still stops one
 *  host hammering the API, without one user's typo costing a stranger their
 *  session.
 *
 *  Successful requests are not counted. A user signing in correctly ten times
 *  is not an attack, and counting them is what turned a tight limit into a
 *  lockout for shared devices and office networks.
 * ──────────────────────────────────────────────────────────────────────────
 */
import rateLimit from 'express-rate-limit';
import { TooManyRequests } from '../lib/errors.js';
import { clientIp } from '../lib/clientIp.js';

const ipKey = (req) => `ip:${clientIp(req)}`;

/**
 * Prefers the account under attack over the network it came from.
 * Falls back to IP for requests that carry no email (refresh, logout).
 */
const identityKey = (req) => {
  const email = req.body?.email;
  if (typeof email === 'string' && email.includes('@')) {
    return `id:${email.trim().toLowerCase()}`;
  }
  if (req.auth?.id) return `id:${req.auth.id}`;
  return ipKey(req);
};

const build = ({ windowMs, max, message, keyGenerator = ipKey, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(TooManyRequests(message)),
  });

/**
 * Whole-API ceiling.
 * Raised from 120/min because a single dashboard load fans out to profile,
 * notifications, listings, adverts and unread counts — five users on one
 * carrier IP could exhaust the old budget just by opening the app.
 */
export const globalLimiter = build({
  windowMs: 60_000,
  max: 600,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/**
 * Credential endpoints, keyed per account.
 * 10 FAILED attempts against one email in 15 minutes. Correct sign-ins are
 * free, so a legitimate user is never locked out by their own success.
 */
export const authLimiter = build({
  windowMs: 15 * 60_000,
  max: 10,
  keyGenerator: identityKey,
  skipSuccessfulRequests: true,
  message: 'Too many attempts for this account. Please wait 15 minutes before trying again.',
});

/**
 * Secondary host ceiling behind authLimiter. Deliberately generous: it exists
 * to stop one machine enumerating thousands of accounts, not to police a
 * shared office or campus network.
 */
export const authIpLimiter = build({
  windowMs: 15 * 60_000,
  max: 200,
  skipSuccessfulRequests: true,
  message: 'Unusual activity from this network. Please try again shortly.',
});

/**
 * OTP issue/verify, keyed per account.
 * Each one costs an email, so it stays tighter than sign-in — but still per
 * address, so one person requesting codes cannot block anyone else.
 */
export const otpLimiter = build({
  windowMs: 10 * 60_000,
  max: 8,
  keyGenerator: identityKey,
  message: 'Too many verification code requests for this account. Please wait a few minutes.',
});

export const otpIpLimiter = build({
  windowMs: 10 * 60_000,
  max: 100,
  message: 'Unusual activity from this network. Please try again shortly.',
});

export const uploadLimiter = build({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => (req.auth?.id ? `id:${req.auth.id}` : ipKey(req)),
  message: 'Too many uploads in a short time. Please wait a moment.',
});

/** Advert photo uploads arrive in batches of up to 12, so this sits above uploadLimiter. */
export const advertUploadLimiter = build({
  windowMs: 60_000,
  max: 120,
  keyGenerator: (req) => (req.auth?.id ? `id:${req.auth.id}` : ipKey(req)),
  message: 'Too many photo uploads in a short time. Please wait a moment.',
});
