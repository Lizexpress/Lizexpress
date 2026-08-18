/**
 * Controllers are deliberately thin: read the request, call one service,
 * shape the response. No business rules, no database access.
 */
import authService from '../services/auth.service.js';
import { ok, created } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';
import { requestContext as context } from '../lib/clientIp.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register({ ...req.body, request: context(req) });
  created(res, result);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  ok(res, await authService.verifyEmail(req.body));
});

export const resendCode = asyncHandler(async (req, res) => {
  ok(res, await authService.resendCode({ ...req.body, request: context(req) }));
});

export const login = asyncHandler(async (req, res) => {
  ok(res, await authService.login({ ...req.body, request: context(req) }));
});

export const refresh = asyncHandler(async (req, res) => {
  ok(res, await authService.refresh(req.body));
});

export const logout = asyncHandler(async (req, res) => {
  ok(res, await authService.logout({ accessToken: req.auth.token }));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  ok(res, await authService.requestPasswordReset({ ...req.body, request: context(req) }));
});

export const verifyResetCode = asyncHandler(async (req, res) => {
  ok(res, await authService.verifyPasswordResetCode(req.body));
});

export const resetPassword = asyncHandler(async (req, res) => {
  ok(res, await authService.resetPassword({ ...req.body, request: context(req) }));
});

export const changePassword = asyncHandler(async (req, res) => {
  ok(
    res,
    await authService.changePassword({
      userId: req.auth.id,
      email: req.auth.email,
      ...req.body,
      request: context(req),
    }),
  );
});

export const me = asyncHandler(async (req, res) => {
  ok(res, await authService.me({ userId: req.auth.id, email: req.auth.email }));
});
