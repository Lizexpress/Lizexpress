/**
 * Authenticates the caller from a Supabase access token.
 * Populates req.auth = { id, email, role, isVerified, token }.
 *
 * Works identically for the web app and the mobile app — both send
 * `Authorization: Bearer <supabase access_token>`.
 */
import { anonClient, adminClient, unwrap } from '../lib/supabase.js';
import { Unauthorized, Forbidden, asyncHandler } from '../lib/errors.js';
import { ADMIN_ROLES } from '../config/constants.js';

const extractToken = (req) => {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.lx_access_token ?? null;
};

const loadIdentity = async (token) => {
  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) throw Unauthorized('Session is invalid or has expired.');

  const profile = unwrap(
    await adminClient
      .from('users')
      .select('id, full_name, avatar_url, role, is_verified, is_suspended, profile_completed, account_types, onboarding_completed')
      .eq('id', data.user.id)
      .maybeSingle(),
    'load profile',
  );

  if (profile?.is_suspended) {
    throw Forbidden('This account has been suspended. Contact support@lizexpressltd.com.');
  }

  return {
    id: data.user.id,
    email: data.user.email,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    role: profile?.role ?? 'user',
    isVerified: Boolean(profile?.is_verified),
    profileCompleted: Boolean(profile?.profile_completed),
    accountTypes: profile?.account_types ?? ['swapper'],
    onboardingCompleted: profile ? Boolean(profile.onboarding_completed) : true,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    token,
  };
};

/** Hard gate — 401 when no valid session. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw Unauthorized('Authentication required.');
  req.auth = await loadIdentity(token);
  next();
});

/** Soft gate — attaches identity when present, never rejects. Used on public browse routes. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.auth = await loadIdentity(token);
    } catch {
      req.auth = null;
    }
  }
  next();
});

/** Only KYC-approved users may list items or open chats. */
export const requireVerified = (req, _res, next) => {
  if (!req.auth) return next(Unauthorized('Authentication required.'));
  if (!req.auth.isVerified) {
    return next(
      Forbidden('Your identity must be verified before you can do this.', {
        action: 'complete_verification',
      }),
    );
  }
  next();
};

/**
 * Staff gate. Roles live on users.role and are only writable by service-role,
 * so they cannot be self-assigned from the client.
 */
export const requireAdmin = (...allowed) => (req, _res, next) => {
  if (!req.auth) return next(Unauthorized('Authentication required.'));
  const permitted = allowed.length ? allowed : ADMIN_ROLES;
  if (!permitted.includes(req.auth.role)) {
    return next(Forbidden('You do not have permission to access the admin area.'));
  }
  next();
};
