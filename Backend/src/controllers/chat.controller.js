import chatService from '../services/chat.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';

export const start = asyncHandler(async (req, res) =>
  created(res, await chatService.startConversation({ itemId: req.body.itemId, userId: req.auth.id })),
);

export const list = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await chatService.listConversations({
    userId: req.auth.id,
    ...req.validatedQuery,
  });
  paginated(res, items, { page, limit, total });
});

export const detail = asyncHandler(async (req, res) =>
  ok(
    res,
    await chatService.conversation({
      chatId: req.params.id,
      userId: req.auth.id,
      ...(req.validatedQuery ?? {}),
    }),
  ),
);

export const send = asyncHandler(async (req, res) =>
  created(res, await chatService.sendMessage({ chatId: req.params.id, senderId: req.auth.id, ...req.body })),
);

export const typing = asyncHandler(async (req, res) =>
  ok(res, await chatService.setTyping({ chatId: req.params.id, userId: req.auth.id, isTyping: req.body.isTyping })),
);

export const markRead = asyncHandler(async (req, res) =>
  ok(res, await chatService.markRead({ chatId: req.params.id, userId: req.auth.id })),
);

export const archive = asyncHandler(async (req, res) =>
  ok(res, await chatService.archive({ chatId: req.params.id, userId: req.auth.id, archived: req.body.archived })),
);

export const unreadCount = asyncHandler(async (req, res) =>
  ok(res, { unread: await chatService.unreadCount(req.auth.id) }),
);
