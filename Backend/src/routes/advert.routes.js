import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/advert.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { advertUploadLimiter } from '../middleware/rateLimit.js';
import { advertSchemas } from '../validators/advert.validators.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/* ── Reference data (public, cacheable) ── */
router.get('/states', controller.states);
router.get('/lgas', validate({ query: advertSchemas.lgaQuery }), controller.lgas);
router.get('/locations', controller.locations);

/* ── Daily expiry sweep, called by Vercel Cron (see vercel.json). ── */
router.get('/cron/expire', controller.cronExpire);

/* ── Browse (public) ── */
router.get('/', validate({ query: advertSchemas.search }), controller.search);

/* ── Advertiser's own adverts.
   Mounted BEFORE /:id so "mine" is never parsed as a UUID. ── */
router.get('/mine', requireAuth, validate({ query: advertSchemas.mine }), controller.mine);

router.post('/', requireAuth, validate({ body: advertSchemas.create }), controller.create);

router.get('/:id', optionalAuth, validate({ params: advertSchemas.idParam }), controller.detail);

router.post(
  '/:id/contact',
  optionalAuth,
  validate({ params: advertSchemas.idParam }),
  controller.recordContact,
);

router.patch(
  '/:id',
  requireAuth,
  validate({ params: advertSchemas.idParam, body: advertSchemas.update }),
  controller.update,
);

router.delete('/:id', requireAuth, validate({ params: advertSchemas.idParam }), controller.remove);

/* ── Photos: ₦1,000 each, billed on publish ── */
router.post(
  '/:id/photos',
  requireAuth,
  advertUploadLimiter,
  upload.single('photo'),
  validate({ params: advertSchemas.idParam }),
  controller.addPhoto,
);

router.delete(
  '/photos/:photoId',
  requireAuth,
  validate({ params: advertSchemas.photoIdParam }),
  controller.removePhoto,
);

/* ── Billing ── */
router.get('/:id/quote', requireAuth, validate({ params: advertSchemas.idParam }), controller.quote);
router.post('/:id/checkout', requireAuth, validate({ params: advertSchemas.idParam }), controller.checkout);

export default router;
