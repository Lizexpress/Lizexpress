import { Router } from 'express';
import * as controller from '../controllers/payment.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { paymentSchemas, pagination } from '../validators/index.js';

const router = Router();

router.get('/quote/:itemId', requireAuth, controller.quote);
router.post('/initialise', requireAuth, validate({ body: paymentSchemas.initialise }), controller.initialise);
router.post('/confirm', requireAuth, validate({ body: paymentSchemas.confirm }), controller.confirm);
router.get('/history', requireAuth, validate({ query: pagination }), controller.history);
router.get('/receipt/:txRef', requireAuth, validate({ params: paymentSchemas.refParam }), controller.receipt);

export default router;
