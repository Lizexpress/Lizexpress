import logger from '../lib/logger.js';
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
export const webhook = async (req, res) => {
  // Flutterwave marks the URL as "down" on anything but 200, so the only
  // non-200 answer is 503 when Flutterwave's own API could not be reached —
  // that one we want retried.
  try {
    const signature = req.get('verif-hash');
    let payload = {};
    try {
      payload = readWebhookPayload(req);
    } catch {
      return res.status(200).json({ success: true, ignored: true, reason: 'empty or unreadable body' });
    }
    const result = await paymentService.handleWebhook({ signature, payload });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error?.status === 503) return res.status(503).json({ success: false, retry: true });
    logger.error('webhook.failed', { error: error.message, stack: error.stack });
    return res.status(200).json({ success: false, logged: true });
  }
};

/** GET on the webhook URL: open it in a browser to confirm the server answers. */
export const webhookHealth = (req, res) =>
  res.status(200).json({
    success: true,
    message: 'LizExpress payment webhook is reachable. Flutterwave sends POST requests here.',
    hashConfigured: Boolean(process.env.FLUTTERWAVE_WEBHOOK_HASH),
  });
