import adminService from '../services/admin.service.js';
import { feedbackRepository } from '../repositories/admin.repository.js';
import { ok, created, paginated, noContent } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';
import { requestContext as context } from '../lib/clientIp.js';

const page = (res, result) => paginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });

/* Dashboard */
export const overview = asyncHandler(async (_req, res) => ok(res, await adminService.overview()));
export const timeseries = asyncHandler(async (req, res) => ok(res, await adminService.timeseries(req.validatedQuery)));
export const analytics = asyncHandler(async (_req, res) => ok(res, await adminService.analytics()));
export const health = asyncHandler(async (_req, res) => ok(res, await adminService.systemHealth()));

/* Users */
export const listUsers = asyncHandler(async (req, res) => page(res, await adminService.listUsers(req.validatedQuery)));
export const userDetail = asyncHandler(async (req, res) => ok(res, await adminService.userDetail(req.params.id)));

export const suspendUser = asyncHandler(async (req, res) =>
  ok(res, await adminService.setSuspension({ id: req.params.id, actorId: req.auth.id, ...req.body, request: context(req) })),
);

export const setRole = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.setRole({
      id: req.params.id,
      actorId: req.auth.id,
      actorRole: req.auth.role,
      role: req.body.role,
      request: context(req),
    }),
  ),
);

export const invite = asyncHandler(async (req, res) =>
  created(res, await adminService.inviteAdmin({ ...req.body, actorId: req.auth.id, actorName: req.auth.fullName })),
);

export const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser({ id: req.params.id, actorId: req.auth.id, request: context(req) });
  noContent(res);
});

/* Moderation */
export const listItems = asyncHandler(async (req, res) => page(res, await adminService.listItems(req.validatedQuery)));

export const setItemStatus = asyncHandler(async (req, res) =>
  ok(res, await adminService.setItemStatus({ id: req.params.id, actorId: req.auth.id, ...req.body, request: context(req) })),
);

export const listPayments = asyncHandler(async (req, res) => page(res, await adminService.listPayments(req.validatedQuery)));
export const recentMessages = asyncHandler(async (req, res) => ok(res, await adminService.recentMessages(50)));

/* Tasks */
export const createTask = asyncHandler(async (req, res) =>
  created(res, await adminService.createTask({ actorId: req.auth.id, payload: req.body })),
);
export const listTasks = asyncHandler(async (req, res) => page(res, await adminService.listTasks(req.validatedQuery)));
export const updateTask = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateTask({ id: req.params.id, payload: req.body })),
);
export const deleteTask = asyncHandler(async (req, res) => {
  await adminService.deleteTask({ id: req.params.id });
  noContent(res);
});

/* Settings, feedback, audit */
export const settings = asyncHandler(async (_req, res) => ok(res, await adminService.settings()));
export const updateSetting = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateSetting({ ...req.body, actorId: req.auth.id })),
);
export const listFeedback = asyncHandler(async (req, res) => page(res, await adminService.listFeedback(req.validatedQuery)));
export const updateFeedback = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateFeedback({ id: req.params.id, payload: req.body })),
);
export const auditLog = asyncHandler(async (req, res) => page(res, await adminService.auditLog(req.validatedQuery)));

/* Public testimonials source */
export const testimonials = asyncHandler(async (_req, res) => ok(res, await feedbackRepository.testimonials(12)));
