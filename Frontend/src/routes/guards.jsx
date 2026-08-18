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
   * Signed in but not staff -> 404, deliberately, rather than "forbidden".
   * A 403 confirms the console exists at this URL; a 404 tells a probing
   * account nothing it did not already know.
   *
   * This is a convenience boundary, not the security boundary: the guard only
   * decides what renders. Every admin endpoint independently re-checks the
   * caller's role server-side, so editing this in devtools grants nothing.
   */
  if (!isStaff) return <Navigate to="/404" replace />;

  return <Outlet />;
};
