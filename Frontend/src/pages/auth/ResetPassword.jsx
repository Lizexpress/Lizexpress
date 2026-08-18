import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Check, ArrowLeft } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';
import { OtpInput } from './OtpInput.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { cn } from '../../lib/cn.js';

const RULES = [
  { test: (value) => value.length >= 8, label: 'At least 8 characters' },
  { test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper and lowercase letters' },
  { test: (value) => /\d/.test(value), label: 'At least one number' },
];

/**
 * Two steps in one screen: verify the code, then set the password.
 *
 * The split matters — the new password is never sent alongside the OTP, and the
 * user finds out immediately whether their code was valid instead of typing a
 * password first and being told the code expired.
 */
const ResetPassword = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const email = state?.email;
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  const verifyCode = async (submitted) => {
    const value = submitted ?? code;
    if (value.length !== 6) return;

    setIsSubmitting(true);
    setError('');
    try {
      const { resetToken: token } = await endpoints.auth.verifyResetCode({ email, code: value });
      setResetToken(token);
      setStep('password');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That code did not work.');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await endpoints.auth.resetPassword({ resetToken, newPassword: password });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldError = caught.fieldErrors.newPassword;
        setError(fieldError ?? caught.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!email) return null;

  return (
    <AuthShell
      eyebrow="Password reset"
      title={step === 'code' ? 'Enter your reset code' : 'Choose a new password'}
      description={
        step === 'code' ? (
          <>
            We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>. It expires in 10 minutes.
          </>
        ) : (
          'Pick something you have not used on another site.'
        )
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-purple-600 hover:underline">
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {step === 'code' ? (
        <div className="space-y-5">
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError('');
            }}
            onComplete={verifyCode}
            disabled={isSubmitting}
            hasError={Boolean(error)}
          />
          <Button
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Checking your code"
            onClick={() => verifyCode()}
            disabled={code.length !== 6}
          >
            Continue
          </Button>
        </div>
      ) : (
        <form onSubmit={savePassword} noValidate className="space-y-4">
          <Input
            label="New password"
            type="password"
            icon={Lock}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a strong password"
            autoComplete="new-password"
            required
          />

          {password && (
            <ul className="space-y-1">
              {RULES.map((rule) => {
                const passed = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={cn('flex items-center gap-1.5 text-xs', passed ? 'text-success' : 'text-ink-muted')}
                  >
                    <Check size={13} className={cn(!passed && 'opacity-30')} aria-hidden="true" />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Saving"
            disabled={!RULES.every((rule) => rule.test(password))}
          >
            Save new password
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
