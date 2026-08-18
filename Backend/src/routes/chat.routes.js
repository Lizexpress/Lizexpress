import { Router } from 'express';
import * as controller from '../controllers/chat.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireVerified } from '../middleware/auth.js';
import { chatSchemas, pagination } from '../validators/index.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: chatSchemas.list }), controller.list);
router.get('/unread-count', controller.unreadCount);
router.post('/', requireVerified, validate({ body: chatSchemas.start }), controller.start);

router.get('/:id', validate({ params: chatSchemas.idParam, query: pagination }), controller.detail);
router.post('/:id/messages', validate({ params: chatSchemas.idParam, body: chatSchemas.sendMessage }), controller.send);
router.post('/:id/typing', validate({ params: chatSchemas.idParam, body: chatSchemas.typing }), controller.typing);
router.post('/:id/read', validate({ params: chatSchemas.idParam }), controller.markRead);
router.patch('/:id/archive', validate({ params: chatSchemas.idParam, body: chatSchemas.archive }), controller.archive);

export default router;
