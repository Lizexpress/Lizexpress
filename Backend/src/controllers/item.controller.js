import itemService from '../services/item.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';

export const create = asyncHandler(async (req, res) =>
  created(res, await itemService.create({ userId: req.auth.id, payload: req.body })),
);

export const browse = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await itemService.browse(req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const detail = asyncHandler(async (req, res) =>
  ok(res, await itemService.detail({ id: req.params.id, viewerId: req.auth?.id })),
);

export const update = asyncHandler(async (req, res) =>
  ok(res, await itemService.update({ id: req.params.id, userId: req.auth.id, payload: req.body })),
);

export const remove = asyncHandler(async (req, res) =>
  ok(res, await itemService.remove({ id: req.params.id, userId: req.auth.id })),
);

export const markSwapped = asyncHandler(async (req, res) =>
  ok(res, await itemService.markSwapped({ id: req.params.id, userId: req.auth.id })),
);

export const mine = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await itemService.mine({ userId: req.auth.id, ...req.validatedQuery });
  paginated(res, items, { page, limit, total });
});

export const toggleFavorite = asyncHandler(async (req, res) =>
  ok(res, await itemService.toggleFavorite({ userId: req.auth.id, itemId: req.params.id })),
);

export const favorites = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await itemService.favorites({ userId: req.auth.id, ...req.validatedQuery });
  paginated(res, items, { page, limit, total });
});

export const categories = asyncHandler(async (_req, res) => ok(res, await itemService.categories()));
