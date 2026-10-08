import engagementService from '../services/engagement.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';

const target = (req) => ({ type: req.params.type, id: req.params.id });

export const state = asyncHandler(async (req, res) => {
  ok(res, await engagementService.stateFor({ ...target(req), userId: req.auth?.id }));
});

export const viewerState = asyncHandler(async (req, res) => {
  ok(res, await engagementService.viewerState({ ...req.validatedQuery, userId: req.auth.id }));
});

export const like = asyncHandler(async (req, res) => {
  ok(res, await engagementService.toggleLike({ ...target(req), userId: req.auth.id }));
});

export const save = asyncHandler(async (req, res) => {
  ok(res, await engagementService.toggleSave({ ...target(req), userId: req.auth.id }));
});

export const share = asyncHandler(async (req, res) => {
  ok(res, await engagementService.share({ ...target(req), userId: req.auth?.id }));
});

export const comments = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await engagementService.listComments({ ...target(req), ...req.validatedQuery });
  paginated(res, items, { page, limit, total });
});

export const addComment = asyncHandler(async (req, res) => {
  created(
    res,
    await engagementService.addComment({
      ...target(req),
      userId: req.auth.id,
      userName: req.auth.fullName,
      body: req.body.body,
      parentId: req.body.parentId,
    }),
  );
});

export const deleteComment = asyncHandler(async (req, res) => {
  ok(res, await engagementService.deleteComment({ commentId: req.params.commentId, userId: req.auth.id, role: req.auth.role }));
});

export const mine = asyncHandler(async (req, res) => {
  ok(res, await engagementService.ownerOverview({ ownerId: req.auth.id, days: req.validatedQuery.days }));
});

/* ── Admin ── */

export const adminOverview = asyncHandler(async (req, res) => {
  ok(res, await engagementService.adminOverview({ days: req.validatedQuery.days }));
});

export const adminComments = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await engagementService.adminComments(req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const adminHideComment = asyncHandler(async (req, res) => {
  ok(res, await engagementService.adminSetCommentHidden({ commentId: req.params.commentId, hidden: req.body.hidden, actorId: req.auth.id }));
});
