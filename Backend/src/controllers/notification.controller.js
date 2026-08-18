import notificationService from '../services/notification.service.js';
import pushService from '../services/push.service.js';
import { ok, created, paginated, noContent } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';

export const list = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await notificationService.list(req.auth.id, req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const unreadCount = asyncHandler(async (req, res) =>
  ok(res, { unread: await notificationService.unreadCount(req.auth.id) }),
);

export const markRead = asyncHandler(async (req, res) =>
  ok(res, await notificationService.markRead(req.params.id, req.auth.id)),
);

export const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.auth.id);
  ok(res, { updated: true });
});

export const remove = asyncHandler(async (req, res) => {
  await notificationService.remove(req.params.id, req.auth.id);
  noContent(res);
});

/* Web Push */
export const publicKey = asyncHandler(async (_req, res) => ok(res, { publicKey: pushService.getPublicKey() }));

export const subscribe = asyncHandler(async (req, res) =>
  created(
    res,
    await pushService.subscribe({
      userId: req.auth.id,
      subscription: req.body.subscription,
      platform: req.body.platform,
      deviceId: req.body.deviceId,
      userAgent: req.get('user-agent'),
    }),
  ),
);

export const unsubscribe = asyncHandler(async (req, res) => {
  await pushService.unsubscribe({ userId: req.auth.id, endpoint: req.body.endpoint });
  noContent(res);
});
