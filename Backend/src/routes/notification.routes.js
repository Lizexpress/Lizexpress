import { Router } from 'express';
import * as controller from '../controllers/notification.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationSchemas } from '../validators/index.js';

const router = Router();

router.get('/push/public-key', controller.publicKey);

router.use(requireAuth);
router.get('/', validate({ query: notificationSchemas.list }), controller.list);
router.get('/unread-count', controller.unreadCount);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', validate({ params: notificationSchemas.idParam }), controller.markRead);
router.delete('/:id', validate({ params: notificationSchemas.idParam }), controller.remove);

router.post('/push/subscribe', validate({ body: notificationSchemas.subscribe }), controller.subscribe);
router.post('/push/unsubscribe', validate({ body: notificationSchemas.unsubscribe }), controller.unsubscribe);

export default router;
