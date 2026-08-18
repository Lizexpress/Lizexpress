import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/verification.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { verificationSchemas } from '../validators/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const router = Router();
router.use(requireAuth);

router.get('/me', controller.myStatus);
router.post('/', validate({ body: verificationSchemas.submit }), controller.submit);

// kind: identity_front | identity_back | address | selfie
router.post('/documents/:kind', uploadLimiter, upload.single('file'), controller.uploadDocument);

export default router;
