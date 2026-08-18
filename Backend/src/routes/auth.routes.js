import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import { authSchemas } from '../validators/index.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: authSchemas.register }), controller.register);
router.post('/verify-email', otpLimiter, validate({ body: authSchemas.verifyEmail }), controller.verifyEmail);
router.post('/resend-code', otpLimiter, validate({ body: authSchemas.resendCode }), controller.resendCode);
router.post('/login', authLimiter, validate({ body: authSchemas.login }), controller.login);
router.post('/refresh', validate({ body: authSchemas.refresh }), controller.refresh);
router.post('/logout', requireAuth, controller.logout);

router.post('/forgot-password', otpLimiter, validate({ body: authSchemas.forgotPassword }), controller.forgotPassword);
router.post('/verify-reset-code', otpLimiter, validate({ body: authSchemas.verifyResetCode }), controller.verifyResetCode);
router.post('/reset-password', authLimiter, validate({ body: authSchemas.resetPassword }), controller.resetPassword);
router.post('/change-password', requireAuth, validate({ body: authSchemas.changePassword }), controller.changePassword);

router.get('/me', requireAuth, controller.me);

export default router;
