/**
 * Thin by design: read the request, call one service, shape the response.
 * No business rules and no database access live here.
 */
import advertService from '../services/advert.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';
import { requestContext as context } from '../lib/clientIp.js';

/* ── Public ── */

export const search = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await advertService.search(req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await advertService.detail({ advertId: req.params.id, viewerId: req.auth?.id }));
});

export const recordContact = asyncHandler(async (req, res) => {
  ok(res, await advertService.recordContact({ advertId: req.params.id, viewerId: req.auth?.id }));
});

export const locations = asyncHandler(async (_req, res) => {
  ok(res, await advertService.locations());
});

export const states = asyncHandler(async (_req, res) => {
  ok(res, await advertService.states());
});

export const lgas = asyncHandler(async (req, res) => {
  ok(res, await advertService.lgas(req.validatedQuery.stateCode));
});

/* ── Advertiser ── */

export const create = asyncHandler(async (req, res) => {
  created(res, await advertService.create({ userId: req.auth.id, payload: req.body }));
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await advertService.update({ advertId: req.params.id, userId: req.auth.id, payload: req.body }));
});

export const remove = asyncHandler(async (req, res) => {
  ok(res, await advertService.remove({ advertId: req.params.id, userId: req.auth.id }));
});

export const mine = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await advertService.mine({ userId: req.auth.id, ...req.validatedQuery });
  paginated(res, items, { page, limit, total });
});

export const addPhoto = asyncHandler(async (req, res) => {
  created(
    res,
    await advertService.addPhoto({
      advertId: req.params.id,
      userId: req.auth.id,
      file: req.file,
      caption: req.body?.caption,
    }),
  );
});

export const removePhoto = asyncHandler(async (req, res) => {
  ok(res, await advertService.removePhoto({ photoId: req.params.photoId, userId: req.auth.id }));
});

export const quote = asyncHandler(async (req, res) => {
  ok(res, await advertService.quote({ advertId: req.params.id, userId: req.auth.id }));
});

export const checkout = asyncHandler(async (req, res) => {
  ok(res, await advertService.checkout({ advertId: req.params.id, userId: req.auth.id, email: req.auth.email }));
});

/* ── Admin ── */

export const adminList = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await advertService.adminList(req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const adminDetail = asyncHandler(async (req, res) => {
  ok(res, await advertService.adminDetail(req.params.id));
});

export const adminSetStatus = asyncHandler(async (req, res) => {
  ok(
    res,
    await advertService.adminSetStatus({
      advertId: req.params.id,
      ...req.body,
      actorId: req.auth.id,
      request: context(req),
    }),
  );
});

export const adminStats = asyncHandler(async (_req, res) => {
  ok(res, await advertService.adminStats());
});

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without the secret
 * set, anyone could trigger it — harmless (it only ends adverts already past
 * their date), but it is still refused so the endpoint is not an open door.
 */
export const cronExpire = asyncHandler(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorised.' } });
  }
  const ended = await advertService.expireLapsed({ force: true });
  return ok(res, { ended });
});
