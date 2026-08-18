import { Router } from 'express';
import * as controller from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { userSchemas } from '../validators/index.js';

const router = Router();

router.get('/me', requireAuth, controller.profile);
router.patch('/me', requireAuth, validate({ body: userSchemas.updateProfile }), controller.updateProfile);
router.patch('/me/preferences', requireAuth, validate({ body: userSchemas.preferences }), controller.updatePreferences);
router.get('/me/dashboard', requireAuth, controller.dashboard);
router.get('/:id', optionalAuth, validate({ params: userSchemas.idParam }), controller.publicProfile);

export default router;
