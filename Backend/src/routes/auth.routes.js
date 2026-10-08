import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, authIpLimiter, otpLimiter, otpIpLimiter } from '../middleware/rateLimit.js';
import { authSchemas } from '../validators/index.js';
import { onboardingSchemas } from '../validators/advert.validators.js';

const router = Router();

/**
 * Two limiters per credential endpoint, in this order:
 *   authLimiter   — per ACCOUNT, tight. Stops credential stuffing on one email.
 *   authIpLimiter — per HOST, loose. Stops one machine enumerating many emails.
 *
 * The old single IP-keyed limiter meant ten bad attempts anywhere on a carrier
 * NAT locked out every other subscriber behind the same address.
 */
router.post('/register', authLimiter, authIpLimiter, validate({ body: authSchemas.register }), controller.register);
router.post('/verify-email', otpLimiter, otpIpLimiter, validate({ body: authSchemas.verifyEmail }), controller.verifyEmail);
router.post('/resend-code', otpLimiter, otpIpLimiter, validate({ body: authSchemas.resendCode }), controller.resendCode);
router.post('/login', authLimiter, authIpLimiter, validate({ body: authSchemas.login }), controller.login);

// No limiter: refresh is driven by token expiry, not by a human, and throttling
// it logs active users out mid-session.
router.post('/refresh', validate({ body: authSchemas.refresh }), controller.refresh);
router.post('/logout', requireAuth, controller.logout);

router.post('/forgot-password', otpLimiter, otpIpLimiter, validate({ body: authSchemas.forgotPassword }), controller.forgotPassword);
router.post('/verify-reset-code', otpLimiter, otpIpLimiter, validate({ body: authSchemas.verifyResetCode }), controller.verifyResetCode);
router.post('/reset-password', authLimiter, authIpLimiter, validate({ body: authSchemas.resetPassword }), controller.resetPassword);
router.post('/change-password', requireAuth, validate({ body: authSchemas.changePassword }), controller.changePassword);

/* ── Onboarding: swapping, advertising, or both ── */
router.post(
  '/onboarding',
  requireAuth,
  validate({ body: onboardingSchemas.complete }),
  controller.completeOnboarding,
);

router.get('/me', requireAuth, controller.me);

export default router;
