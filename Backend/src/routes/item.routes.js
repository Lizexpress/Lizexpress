import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/item.controller.js';
import { uploadImage } from '../controllers/misc.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth, requireVerified } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { itemSchemas, pagination } from '../validators/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const router = Router();

// Public
router.get('/', optionalAuth, validate({ query: itemSchemas.browse }), controller.browse);
router.get('/categories', controller.categories);

// Owner — listing requires a verified identity
router.get('/me/listings', requireAuth, validate({ query: itemSchemas.mine }), controller.mine);
router.get('/me/favorites', requireAuth, validate({ query: pagination }), controller.favorites);
router.post('/', requireAuth, requireVerified, validate({ body: itemSchemas.create }), controller.create);
router.post('/upload', requireAuth, uploadLimiter, upload.single('file'), uploadImage);

router.get('/:id', optionalAuth, validate({ params: itemSchemas.idParam }), controller.detail);
router.patch('/:id', requireAuth, validate({ params: itemSchemas.idParam, body: itemSchemas.update }), controller.update);
router.delete('/:id', requireAuth, validate({ params: itemSchemas.idParam }), controller.remove);
router.post('/:id/swapped', requireAuth, validate({ params: itemSchemas.idParam }), controller.markSwapped);
router.post('/:id/favorite', requireAuth, validate({ params: itemSchemas.idParam }), controller.toggleFavorite);

export default router;
