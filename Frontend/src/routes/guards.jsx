import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';

/**
 * Guards read the auth state machine directly.
 *
 * The important detail: while status is 'loading' they render a loader rather
 * than redirecting. Treating "not loaded yet" as "not signed in" is what causes
 * the login screen to flash before a signed-in user's page appears.
 */
export const RequireAuth = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;
  if (status === 'anonymous') {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
};

export const RequireVerified = () => {
  const { status, isVerified } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isVerified) return <Navigate to="/id-verification" replace state={{ from: location, reason: 'verify_to_list' }} />;
  return <Outlet />;
};

export const RequireStaff = () => {
  const { status, isStaff } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  // Not signed in -> the staff sign-in page, not the public one. Remember the
  // destination so the console lands where they were headed.
  if (status === 'anonymous') {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  /**
   * Signed in, but not staff -> the staff sign-in page with an explanation.
   *
   * This previously redirected to /404 to avoid confirming the console exists.
   * That reasoning does not hold: /admin/login is a public URL, so anyone can
   * already confirm it. All the 404 achieved was making a legitimate owner --
   * signed in on their normal account -- think the console was missing.
   *
   * Either way it is not the security boundary. Every admin endpoint re-checks
   * the caller's role server-side, so what renders here grants no access.
   */
  if (!isStaff) {
    return <Navigate to="/admin/login" replace state={{ from: location, denied: true }} />;
  }

  return <Outlet />;
};
