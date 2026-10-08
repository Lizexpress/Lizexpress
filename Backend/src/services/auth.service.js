/**
 * Authentication.
 *
 * Supabase Auth remains the identity store — we did NOT build a parallel user
 * table with our own JWTs. Every existing v1 user keeps their account and
 * password, RLS keeps working against auth.uid(), and the mobile app gets a
 * standard refreshable session.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  WHAT CHANGED IN THIS REVISION, AND WHY
 *
 *  1. Account lookup no longer scans auth.admin.listUsers({ perPage: 200 }).
 *     That call returns ONE PAGE. Every account past row 200 was invisible to
 *     it, which is why sign-up said "no account", forgot-password silently did
 *     nothing, and verify-email 404'd for most of the existing user base. It is
 *     now a single indexed row lookup through find_auth_user_by_email (001).
 *
 *  2. Password reset can no longer leak account existence through a rate-limit
 *     error. The old code promised "always report success" but let issueOtp's
 *     cooldown exception escape, so a 429 proved the email was registered —
 *     and a user who double-clicked Send got locked into a 60-second wall.
 *
 *  3. Session minting falls back to a recovery link when a magic link is
 *     unavailable (magic links can be disabled per project, and generateLink
 *     rejects unconfirmed addresses).
 *
 *  4. Re-registering over an unconfirmed signup no longer rewrites role, so a
 *     staff account cannot be silently demoted to 'user'.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { adminClient, anonClient } from '../lib/supabase.js';
import userRepository from '../repositories/user.repository.js';
import { issueOtp, verifyOtp } from './otp.service.js';
import { sendTemplate, queueTemplate } from './email.service.js';
import { BadRequest, Conflict, Unauthorized, NotFound, Forbidden } from '../lib/errors.js';
import { OTP_PURPOSE } from '../config/constants.js';
import logger from '../lib/logger.js';

const normaliseEmail = (email) => String(email ?? '').trim().toLowerCase();

/**
 * Indexed single-row lookup against auth.users.
 *
 * auth.users is not exposed through PostgREST, so this goes through the
 * SECURITY DEFINER function installed by migration 001. Execute is granted to
 * service_role only — the anon key cannot call it.
 */
const findAuthUserByEmail = async (email) => {
  const clean = normaliseEmail(email);
  if (!clean) return null;

  const { data, error } = await adminClient.rpc('find_auth_user_by_email', { p_email: clean });

  if (error) {
    // A missing function means migration 001 has not been applied. Say so
    // loudly rather than falling back to the broken paged scan, which would
    // reintroduce exactly the bug this replaces.
    logger.error('auth.lookup.failed', { error: error.message });
    throw new Error(
      'Account lookup is unavailable. Ensure migration 0001 has been applied ' +
        '(public.find_auth_user_by_email is missing).',
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    email_confirmed_at: row.email_confirmed_at,
    banned_until: row.banned_until,
    created_at: row.created_at,
  };
};

/**
 * Mints a real Supabase session without a password.
 *
 * generateLink returns a hashed token we redeem immediately — the link is never
 * emailed, so there is no window in which it could be intercepted.
 *
 * Magic links can be switched off at the project level, and generateLink will
 * refuse an address that is not yet confirmed. Rather than fail the whole flow,
 * fall back to a recovery link, which is accepted in both of those cases.
 */
const createSession = async (email) => {
  const clean = normaliseEmail(email);

  const attempt = async (type) => {
    const { data: link, error } = await adminClient.auth.admin.generateLink({ type, email: clean });
    if (error) return { error };

    const { data: session, error: verifyError } = await anonClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: type === 'recovery' ? 'recovery' : 'email',
    });
    if (verifyError) return { error: verifyError };
    return { session: session.session };
  };

  let result = await attempt('magiclink');
  if (result.error) {
    logger.warn('auth.session.magiclink_failed', { reason: result.error.message });
    result = await attempt('recovery');
  }

  if (result.error || !result.session) {
    throw new Error(`Could not create session: ${result.error?.message ?? 'no session returned'}`);
  }

  const { access_token, refresh_token, expires_in, expires_at } = result.session;
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    expiresAt: expires_at,
    tokenType: 'bearer',
  };
};

const publicProfile = async (userId, email) => {
  const profile = await userRepository.findById(userId, { full: true });
  return { ...profile, email };
};

/**
 * OTP issuing that must never break the caller.
 *
 * Used on paths that are contractually silent about whether an account exists
 * (forgot-password) or where the OTP is a side effect of a different outcome
 * (the unconfirmed-email branch of login). A cooldown or a provider blip on
 * those paths must not turn into the user's error message.
 */
const issueOtpQuietly = async (args) => {
  try {
    return await issueOtp(args);
  } catch (error) {
    logger.warn('auth.otp.suppressed', { purpose: args.purpose, reason: error.message });
    return { expiresAt: null, resendAvailableInSeconds: 60, suppressed: true };
  }
};

/* ───────────────────────── Registration ───────────────────────── */

export const register = async ({ email, password, fullName, accountTypes, request }) => {
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

  /**
   * Role is written only when the profile row is new. Upserting role: 'user'
   * unconditionally would demote a staff member who re-ran an unconfirmed
   * signup against their own address.
   */
  const existingProfile = await userRepository.findById(userId, { full: true });
  await userRepository.upsertProfile(userId, {
    full_name: fullName,
    ...(existingProfile ? {} : { role: 'user' }),
    // Onboarding decides the dashboard shape; a brand-new account has not run it.
    ...(existingProfile ? {} : { onboarding_completed: false, onboarding_step: 0 }),
    ...(accountTypes?.length ? { account_types: accountTypes } : {}),
  });

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

      // Quietly — a cooldown here must not replace "confirm your email" with
      // "too many requests", which tells the user nothing actionable.
      await issueOtpQuietly({
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

    if (authUser?.banned_until && new Date(authUser.banned_until) > new Date()) {
      throw Forbidden('This account is temporarily locked. Contact support@lizexpressltd.com.');
    }

    logger.info('auth.login.rejected', { known: Boolean(authUser) });
    throw Unauthorized('Email or password is incorrect.');
  }

  const profile = await userRepository.findById(data.user.id, { full: true });

  if (profile?.is_suspended) {
    throw Forbidden('This account has been suspended. Contact support@lizexpressltd.com.');
  }

  /**
   * Legacy accounts predate the profile row, so a successful password check can
   * still find nothing in public.users. Create it on the spot rather than
   * returning a null profile the client cannot render — this is the difference
   * between an old user signing in cleanly and landing on a blank dashboard.
   */
  if (!profile) {
    logger.warn('auth.login.profile_missing', { userId: data.user.id });
    const repaired = await userRepository.upsertProfile(data.user.id, {
      full_name: data.user.user_metadata?.full_name ?? cleanEmail.split('@')[0],
      role: 'user',
      account_types: ['swapper'],
      onboarding_completed: true, // grandfathered, same as migration 001
      onboarding_step: 99,
    });
    await userRepository.touchLastSeen(data.user.id);
    return {
      session: shapeSession(data.session),
      user: { ...repaired, email: data.user.email },
    };
  }

  await userRepository.touchLastSeen(data.user.id);
  logger.info('auth.login', { userId: data.user.id, ip: request?.ip });

  return {
    session: shapeSession(data.session),
    user: { ...profile, email: data.user.email },
  };
};

const shapeSession = (session) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresIn: session.expires_in,
  expiresAt: session.expires_at,
  tokenType: 'bearer',
});

export const refresh = async ({ refreshToken }) => {
  const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) throw Unauthorized('Your session has expired. Please sign in again.');
  return shapeSession(data.session);
};

export const logout = async ({ accessToken }) => {
  const { error } = await adminClient.auth.admin.signOut(accessToken);
  if (error) logger.warn('auth.logout.failed', { error: error.message });
  // Always reports success: a client that cannot complete sign-out locally is
  // worse than a server-side revocation that quietly no-ops.
  return { loggedOut: true };
};

/* ───────────────────────── Password ───────────────────────── */

export const requestPasswordReset = async ({ email, request }) => {
  const cleanEmail = normaliseEmail(email);
  const authUser = await findAuthUserByEmail(cleanEmail);

  // Always report success. Never confirm whether an account exists — and that
  // includes never letting a cooldown 429 escape, because a 429 for one address
  // and a 200 for another is itself an account oracle.
  if (!authUser) {
    logger.info('auth.reset.unknown_email');
    return { sent: true, expiresAt: null, resendAvailableInSeconds: 60 };
  }

  const profile = await userRepository.findById(authUser.id);
  const otp = await issueOtpQuietly({
    email: cleanEmail,
    purpose: OTP_PURPOSE.PASSWORD_RESET,
    name: profile?.full_name,
    userId: authUser.id,
    request,
  });

  return { sent: true, expiresAt: otp.expiresAt, resendAvailableInSeconds: otp.resendAvailableInSeconds };
};

/**
 * Two-step reset: verify the code, get a short-lived ticket, then set the
 * password. The new password never travels alongside the OTP, and the client
 * can validate the code before showing the password form.
 */
export const verifyPasswordResetCode = async ({ email, code }) => {
  const cleanEmail = normaliseEmail(email);
  await verifyOtp({ email: cleanEmail, purpose: OTP_PURPOSE.PASSWORD_RESET, code });

  const authUser = await findAuthUserByEmail(cleanEmail);
  if (!authUser) throw NotFound('No account found for this email.');

  const session = await createSession(cleanEmail);
  return { resetToken: session.accessToken, expiresIn: session.expiresIn };
};

export const resetPassword = async ({ resetToken, newPassword, request }) => {
  const { data, error } = await anonClient.auth.getUser(resetToken);
  if (error || !data?.user) throw Unauthorized('This reset session has expired. Start again.');

  const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
    email_confirm: true, // a user who proved mailbox control is confirmed by definition
  });
  if (updateError) throw BadRequest(updateError.message);

  const profile = await userRepository.findById(data.user.id);

  // Fire-and-forget: a Resend outage must not make a completed password reset
  // look like a failure to the user whose password has, in fact, changed.
  queueTemplate('passwordChanged', data.user.email, {
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

/* ───────────────────────── Onboarding ───────────────────────── */

/**
 * Records the account types chosen at onboarding. The dashboard renders its
 * sections from this, so "both" has to be storable — hence an array rather
 * than a single enum.
 */
export const completeOnboarding = async ({ userId, accountTypes, business }) => {
  const valid = accountTypes.filter((type) => ['swapper', 'advertiser'].includes(type));
  if (!valid.length) throw BadRequest('Choose at least one account type to continue.');

  const profile = await userRepository.update(userId, {
    account_types: valid,
    onboarding_completed: true,
    onboarding_step: 99,
    ...(business?.name ? { business_name: business.name } : {}),
    ...(business?.phone ? { business_phone: business.phone } : {}),
    ...(business?.about ? { business_about: business.about } : {}),
    ...(business?.state ? { state: business.state } : {}),
    ...(business?.city ? { city: business.city } : {}),
    ...(business?.lga ? { business_lga: business.lga } : {}),
  });

  logger.info('auth.onboarding_completed', { userId, accountTypes: valid });
  return profile;
};

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
  completeOnboarding,
  me,
};
