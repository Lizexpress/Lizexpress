import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import itemRoutes from './item.routes.js';
import chatRoutes from './chat.routes.js';
import verificationRoutes from './verification.routes.js';
import paymentRoutes from './payment.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';
import advertRoutes from './advert.routes.js';
import * as misc from '../controllers/misc.controller.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { feedbackSchemas } from '../validators/index.js';

const router = Router();

router.get('/health', misc.health);
router.get('/testimonials', misc.testimonials);
router.post('/feedback', optionalAuth, validate({ body: feedbackSchemas.create }), misc.submitFeedback);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/items', itemRoutes);
router.use('/chats', chatRoutes);
router.use('/verifications', verificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/adverts', advertRoutes);
router.use('/admin', adminRoutes);

export default router;
