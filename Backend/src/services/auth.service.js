/**
 * Authentication.
 *
 * Design decision worth understanding before changing anything here:
 * Supabase Auth remains the identity store. We did NOT build a parallel user
 * table with our own JWTs. That matters because:
 *   1. Every existing v1 user keeps their account and password.
 *   2. Row Level Security keeps working — policies read auth.uid().
 *   3. The mobile app gets a standard Supabase session it can refresh itself.
 *
 * What changed in v2 is *email delivery only*: Supabase's built-in confirmation
 * mails are switched off, and we issue our own 6-digit codes through Resend.
 * After a code is verified, we mint a genuine Supabase session server-side via
 * generateLink → verifyOtp, so the client ends up with a normal access/refresh
 * token pair and nothing downstream knows the difference.
 */
import { adminClient, anonClient } from '../lib/supabase.js';
import userRepository from '../repositories/user.repository.js';
import { issueOtp, verifyOtp } from './otp.service.js';
import { sendTemplate, queueTemplate } from './email.service.js';
import { BadRequest, Conflict, Unauthorized, NotFound, Forbidden } from '../lib/errors.js';
import { OTP_PURPOSE } from '../config/constants.js';
import logger from '../lib/logger.js';

const normaliseEmail = (email) => String(email).trim().toLowerCase();

const findAuthUserByEmail = async (email) => {
  // listUsers is paginated; filter server-side where the SDK allows it.
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users.find((user) => user.email?.toLowerCase() === normaliseEmail(email)) ?? null;
};

/**
 * Mints a real Supabase session without a password.
 * generateLink returns a hashed token we immediately redeem — the link itself
 * is never emailed, so there is no window in which it could be intercepted.
 */
const createSession = async (email) => {
  const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: normaliseEmail(email),
  });
  if (linkError) throw new Error(`Could not create session: ${linkError.message}`);

  const { data: session, error: verifyError } = await anonClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  });
  if (verifyError) throw new Error(`Could not create session: ${verifyError.message}`);

  return {
    accessToken: session.session.access_token,
    refreshToken: session.session.refresh_token,
    expiresIn: session.session.expires_in,
    expiresAt: session.session.expires_at,
    tokenType: 'bearer',
  };
};

const publicProfile = async (userId, email) => {
  const profile = await userRepository.findById(userId, { full: true });
  return { ...profile, email };
};

/* ───────────────────────── Registration ───────────────────────── */

export const register = async ({ email, password, fullName, request }) => {
  const cleanEmail = normaliseEmail(email);
  const existing = await findAuthUserByEmail(cleanEmail);

  if (existing?.email_confirmed_at) {
    throw Conflict('An account with this email already exists. Try signing in instead.');
  }

  let userId = existing?.id;

  if (existing) {
    // Unconfirmed signup being retried — refresh the password rather than erroring out.
    const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name: fullName },
    });
    if (error) throw BadRequest(error.message);
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: false, // our OTP flow owns confirmation
      user_metadata: { full_name: fullName },
    });
    if (error) throw BadRequest(error.message);
    userId = data.user.id;
  }

  await userRepository.upsertProfile(userId, { full_name: fullName, role: 'user' });
  const otp = await issueOtp({
    email: cleanEmail,
    purpose: OTP_PURPOSE.SIGNUP,
    name: fullName,
    userId,
    request,
  });

  logger.info('auth.registered', { userId });
  return { userId, email: cleanEmail, requiresVerification: true, ...otp };
};

export const verifyEmail = async ({ email, code }) => {
  const cleanEmail = normaliseEmail(email);
  await verifyOtp({ email: cleanEmail, purpose: OTP_PURPOSE.SIGNUP, code });

  const authUser = await findAuthUserByEmail(cleanEmail);
  if (!authUser) throw NotFound('No account found for this email.');

  const { error } = await adminClient.auth.admin.updateUserById(authUser.id, { email_confirm: true });
  if (error) throw BadRequest(error.message);

  const session = await createSession(cleanEmail);
  const profile = await publicProfile(authUser.id, cleanEmail);

  queueTemplate('welcome', cleanEmail, { name: profile.full_name });
  logger.info('auth.email_verified', { userId: authUser.id });

  return { session, user: profile };
};

export const resendCode = async ({ email, purpose, request }) => {
  const cleanEmail = normaliseEmail(email);
  const authUser = await findAuthUserByEmail(cleanEmail);

  // Silently succeed for unknown emails — enumeration protection.
  if (!authUser) {
    return { expiresAt: null, resendAvailableInSeconds: 60 };
  }

  const profile = await userRepository.findById(authUser.id);
  return issueOtp({
    email: cleanEmail,
    purpose,
    name: profile?.full_name,
    userId: authUser.id,
    request,
  });
};

/* ───────────────────────── Sign in ───────────────────────── */

export const login = async ({ email, password, request }) => {
  const cleanEmail = normaliseEmail(email);

  const { data, error } = await anonClient.auth.signInWithPassword({ email: cleanEmail, password });

  if (error) {
    // Distinguish only the case the user can act on: unconfirmed email.
    const authUser = await findAuthUserByEmail(cleanEmail);
    if (authUser && !authUser.email_confirmed_at) {
      const profile = await userRepository.findById(authUser.id);
      await issueOtp({
        email: cleanEmail,
        purpose: OTP_PURPOSE.SIGNUP,
        name: profile?.full_name,
        userId: authUser.id,
        request,
      });
      throw Forbidden('Your email is not confirmed yet. We have sent you a new code.', {
        action: 'verify_email',
        email: cleanEmail,
      });
    }
    throw Unauthorized('Email or password is incorrect.');
  }

  const profile = await userRepository.findById(data.user.id, { full: true });

  if (profile?.is_suspended) {
    throw Forbidden('This account has been suspended. Contact support@lizexpressltd.com.');
  }

  await userRepository.touchLastSeen(data.user.id);
  logger.info('auth.login', { userId: data.user.id, ip: request?.ip });

  return {
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      expiresAt: data.session.expires_at,
      tokenType: 'bearer',
    },
    user: { ...profile, email: data.user.email },
  };
};

export const refresh = async ({ refreshToken }) => {
  const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) throw Unauthorized('Your session has expired. Please sign in again.');

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    expiresAt: data.session.expires_at,
    tokenType: 'bearer',
  };
};

export const logout = async ({ accessToken }) => {
  // Revokes the refresh token family so the session cannot be resurrected.
  const { error } = await adminClient.auth.admin.signOut(accessToken);
  if (error) logger.warn('auth.logout.failed', { error: error.message });
  return { loggedOut: true };
};

/* ───────────────────────── Password ───────────────────────── */

export const requestPasswordReset = async ({ email, request }) => {
  const cleanEmail = normaliseEmail(email);
  const authUser = await findAuthUserByEmail(cleanEmail);

  // Always report success. Never confirm whether an account exists.
  if (!authUser) {
    logger.info('auth.reset.unknown_email');
    return { sent: true, expiresAt: null };
  }

  const profile = await userRepository.findById(authUser.id);
  const otp = await issueOtp({
    email: cleanEmail,
    purpose: OTP_PURPOSE.PASSWORD_RESET,
    name: profile?.full_name,
    userId: authUser.id,
    request,
  });
  return { sent: true, ...otp };
};

/**
 * Two-step reset: verify the code, get a short-lived reset ticket, then set the
 * password. Splitting it means the new password never travels alongside the OTP,
 * and the client can validate the code before showing the password form.
 */
export const verifyPasswordResetCode = async ({ email, code }) => {
  const cleanEmail = normaliseEmail(email);
  await verifyOtp({ email: cleanEmail, purpose: OTP_PURPOSE.PASSWORD_RESET, code });

  const authUser = await findAuthUserByEmail(cleanEmail);
  if (!authUser) throw NotFound('No account found for this email.');

  // A real Supabase session acts as the reset ticket: short-lived and revocable.
  const session = await createSession(cleanEmail);
  return { resetToken: session.accessToken, expiresIn: session.expiresIn };
};

export const resetPassword = async ({ resetToken, newPassword, request }) => {
  const { data, error } = await anonClient.auth.getUser(resetToken);
  if (error || !data?.user) throw Unauthorized('This reset session has expired. Start again.');

  const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });
  if (updateError) throw BadRequest(updateError.message);

  const profile = await userRepository.findById(data.user.id);
  await sendTemplate('passwordChanged', data.user.email, {
    name: profile?.full_name,
    changedAt: new Date().toISOString(),
    ip: request?.ip,
  });

  logger.info('auth.password_reset', { userId: data.user.id });
  return { updated: true };
};

export const changePassword = async ({ userId, email, currentPassword, newPassword, request }) => {
  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: normaliseEmail(email),
    password: currentPassword,
  });
  if (signInError) throw Unauthorized('Your current password is not correct.');

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw BadRequest(error.message);

  const profile = await userRepository.findById(userId);
  queueTemplate('passwordChanged', email, {
    name: profile?.full_name,
    changedAt: new Date().toISOString(),
    ip: request?.ip,
  });

  return { updated: true };
};

export const me = async ({ userId, email }) => publicProfile(userId, email);

export default {
  register,
  verifyEmail,
  resendCode,
  login,
  refresh,
  logout,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  changePassword,
  me,
};
