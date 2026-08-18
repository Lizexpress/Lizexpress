import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { endpoints, tokens, ApiError } from '../lib/api.js';
import { setRealtimeAuth } from '../lib/supabase.js';

/**
 * Single source of truth for who is signed in.
 *
 * `status` is deliberately a state machine rather than a pair of booleans:
 * 'loading' | 'authenticated' | 'anonymous'. Route guards read it directly,
 * which removes the flash-of-login-screen that happens when a guard treats
 * "not loaded yet" the same as "not signed in".
 */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const bootstrapped = useRef(false);

  const applySession = useCallback((session, profile) => {
    if (session) {
      tokens.set(session);
      setRealtimeAuth(session.accessToken);
    }
    setUser(profile ?? null);
    setStatus(profile ? 'authenticated' : 'anonymous');
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (tokens.access) await endpoints.auth.logout();
    } catch {
      // Never block sign-out on a network failure — clear locally regardless.
    }
    tokens.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  /** Restore a stored session on boot. */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      if (!tokens.access) {
        setStatus('anonymous');
        return;
      }
      try {
        const profile = await endpoints.auth.me();
        setRealtimeAuth(tokens.access);
        setUser(profile);
        setStatus('authenticated');
      } catch {
        tokens.clear();
        setStatus('anonymous');
      }
    })();
  }, []);

  /** The API client fires this when a refresh fails irrecoverably. */
  useEffect(() => {
    const handler = () => {
      tokens.clear();
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('lx:session-expired', handler);
    return () => window.removeEventListener('lx:session-expired', handler);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const result = await endpoints.auth.login(credentials);
      applySession(result.session, result.user);
      return result.user;
    },
    [applySession],
  );

  const verifyEmail = useCallback(
    async (payload) => {
      const result = await endpoints.auth.verifyEmail(payload);
      applySession(result.session, result.user);
      return result.user;
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    const profile = await endpoints.auth.me();
    setUser(profile);
    return profile;
  }, []);

  /** Optimistic local patch — used after a profile save so the header updates instantly. */
  const patchUser = useCallback((changes) => {
    setUser((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isVerified: Boolean(user?.is_verified),
      isStaff: ['moderator', 'admin', 'super_admin'].includes(user?.role),
      isSuperAdmin: user?.role === 'super_admin',
      login,
      verifyEmail,
      signOut,
      refreshUser,
      patchUser,
    }),
    [user, status, login, verifyEmail, signOut, refreshUser, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export { ApiError };
