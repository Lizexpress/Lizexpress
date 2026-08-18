import paymentService from '../services/payment.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler, BadRequest } from '../lib/errors.js';

export const quote = asyncHandler(async (req, res) =>
  ok(res, await paymentService.quote({ itemId: req.params.itemId, userId: req.auth.id })),
);

export const initialise = asyncHandler(async (req, res) =>
  created(
    res,
    await paymentService.initialise({ itemId: req.body.itemId, userId: req.auth.id, email: req.auth.email }),
  ),
);

export const confirm = asyncHandler(async (req, res) =>
  ok(res, await paymentService.confirm({ ...req.body, userId: req.auth.id })),
);

export const history = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await paymentService.history({
    userId: req.auth.id,
    ...req.validatedQuery,
  });
  paginated(res, items, { page, limit, total });
});

export const receipt = asyncHandler(async (req, res) =>
  ok(res, await paymentService.receipt({ txRef: req.params.txRef, userId: req.auth.id })),
);

/**
 * Reads the webhook payload whatever shape the platform hands us.
 *
 * The route is mounted with express.raw(), so locally this is a Buffer. Some
 * serverless runtimes (Vercel's Node runtime among them) parse the request body
 * before the framework sees it, in which case req.body arrives already decoded.
 * Assuming a Buffer here would throw on `.toString()` returning "[object
 * Object]", and because we answer 200 to stop retries, that failure would be
 * near-silent: payments would simply never settle.
 */
const readWebhookPayload = (req) => {
  const body = req.body;
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
  if (typeof body === 'string') return JSON.parse(body);
  if (body && typeof body === 'object') return body;
  throw BadRequest('Webhook payload was empty.');
};

/**
 * Flutterwave webhook.
 *
 * Authenticity is established by comparing the verif-hash header against the
 * secret configured in the Flutterwave dashboard, so the exact byte sequence is
 * not required — but the payload still has to be read correctly.
 */
export const webhook = asyncHandler(async (req, res) => {
  const signature = req.get('verif-hash');
  const payload = readWebhookPayload(req);
  const result = await paymentService.handleWebhook({ signature, payload });
  // Always 200 on a processed event so Flutterwave stops retrying.
  res.status(200).json({ success: true, ...result });
});
