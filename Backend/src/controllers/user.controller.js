import userService from '../services/user.service.js';
import { ok } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';

export const profile = asyncHandler(async (req, res) => ok(res, await userService.profile(req.auth.id)));

export const updateProfile = asyncHandler(async (req, res) =>
  ok(res, await userService.updateProfile({ userId: req.auth.id, payload: req.body })),
);

export const publicProfile = asyncHandler(async (req, res) =>
  ok(res, await userService.publicProfile(req.params.id)),
);

export const updatePreferences = asyncHandler(async (req, res) =>
  ok(res, await userService.updatePreferences({ userId: req.auth.id, preferences: req.body.preferences })),
);

export const dashboard = asyncHandler(async (req, res) =>
  ok(res, await userService.dashboardSummary(req.auth.id)),
);
