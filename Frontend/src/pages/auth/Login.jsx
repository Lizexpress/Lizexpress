import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../lib/api.js';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.success(`Welcome back, ${user.full_name?.split(' ')[0] ?? 'there'}.`);
      navigate(state?.from?.pathname ?? '/dashboard', { replace: true });
    } catch (caught) {
      /**
       * The API returns a 403 with action "verify_email" for an unconfirmed
       * account, and has already sent a fresh code. Route straight to the code
       * screen rather than showing an error the user cannot act on.
       */
      if (caught instanceof ApiError && caught.details?.action === 'verify_email') {
        toast.info('Confirm your email to continue. We sent you a new code.');
        navigate('/verify-email', { state: { email: caught.details.email ?? form.email, purpose: 'signup' } });
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not sign you in. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to LizExpress"
      description="Pick up where you left off."
      footer={
        <>
          New to LizExpress?{' '}
          <Link to="/register" className="font-semibold text-purple-600 hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={update('email')}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <div>
          <Input
            label="Password"
            type="password"
            icon={Lock}
            value={form.password}
            onChange={update('password')}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-purple-600 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Signing you in">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
};

export default Login;
