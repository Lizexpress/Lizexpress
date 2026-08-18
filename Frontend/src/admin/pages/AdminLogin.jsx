import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Logo } from '../../components/layout/Logo.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../lib/api.js';

/**
 * Staff sign-in. There is deliberately no registration, no "create account"
 * link, and no password-reset self-service here.
 *
 * Administrator accounts exist only because the migration seeds them, so there
 * is no public path to becoming staff. A forgotten staff password is reset
 * from the database by another super admin, which keeps the privilege boundary
 * on the server rather than in an email inbox.
 *
 * The page also refuses to confirm whether an address is a staff account:
 * a non-staff user who signs in correctly is signed straight back out and
 * shown the same generic message as a wrong password. Otherwise this form
 * doubles as an oracle for enumerating administrator emails.
 */
const AdminLogin = () => {
  const { login, signOut, status, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Staff sign in · LizExpress';
  }, []);

  if (status === 'loading') return <PageLoader label="Checking your session" />;
  if (status === 'authenticated' && isStaff) {
    return <Navigate to={location.state?.from?.pathname ?? '/admin'} replace />;
  }

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const user = await login(form);
      const staff = ['moderator', 'admin', 'super_admin'].includes(user?.role);

      if (!staff) {
        // Correct credentials, but not a staff account. Sign back out and give
        // the same message as a failure so this cannot be used to discover
        // which addresses are administrators.
        await signOut();
        setError('Those details do not match a staff account.');
        return;
      }

      navigate(location.state?.from?.pathname ?? '/admin', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 429
          ? caught.message
          : 'Those details do not match a staff account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-purple-800">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo variant="light" imgClassName="h-10" />
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.11em] text-orange-300">
              <ShieldCheck size={13} aria-hidden="true" />
              Staff access
            </span>
          </div>

          <div className="card p-6 sm:p-8">
            <h1 className="text-heading">Sign in to the console</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              For LizExpress staff only. Accounts are issued by a super admin.
            </p>

            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <Input
                label="Work email"
                type="email"
                icon={Mail}
                value={form.email}
                onChange={update('email')}
                placeholder="you@lizexpressltd.com"
                autoComplete="email"
                required
              />

              <Input
                label="Password"
                type="password"
                icon={Lock}
                value={form.password}
                onChange={update('password')}
                autoComplete="current-password"
                required
              />

              <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Signing in">
                Sign in
              </Button>
            </form>

            <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
              Lost access? Another super admin can reset your password from the database. Staff
              passwords are never reset over email.
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-purple-200/70">
            Every action in the console is recorded against your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
