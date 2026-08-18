import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, RotateCw } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';
import { OtpInput } from './OtpInput.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const RESEND_SECONDS = 60;

const VerifyEmail = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { verifyEmail } = useAuth();

  const email = state?.email;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  // Landing here directly, without an email in navigation state, is a dead end.
  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (submittedCode) => {
      const value = submittedCode ?? code;
      if (value.length !== 6) {
        setError('Enter all six digits.');
        return;
      }

      setIsSubmitting(true);
      setError('');
      try {
        await verifyEmail({ email, code: value });
        toast.success('Email confirmed. Welcome to LizExpress.');
        navigate('/dashboard', { replace: true });
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
        setCode('');
      } finally {
        setIsSubmitting(false);
      }
    },
    [code, email, verifyEmail, toast, navigate],
  );

  const resend = async () => {
    setIsResending(true);
    setError('');
    try {
      await endpoints.auth.resendCode({ email, purpose: state?.purpose ?? 'signup' });
      setCooldown(RESEND_SECONDS);
      setCode('');
      toast.success('A new code is on its way.');
    } catch (caught) {
      // The server enforces its own cooldown and tells us how long is left.
      if (caught instanceof ApiError && caught.details?.retryAfterSeconds) {
        setCooldown(caught.details.retryAfterSeconds);
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not send a new code.');
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null;

  return (
    <AuthShell
      eyebrow="Verify your email"
      title="Enter your 6-digit code"
      description={
        <>
          We sent a code to <span className="font-semibold text-ink">{email}</span>. It expires in 10 minutes.
        </>
      }
      footer={
        <>
          Wrong email address?{' '}
          <Link to="/register" className="font-semibold text-purple-600 hover:underline">Start again</Link>
        </>
      }
    >
      <div className="space-y-5">
        <OtpInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setError('');
          }}
          onComplete={submit}
          disabled={isSubmitting}
          hasError={Boolean(error)}
        />

        {error && (
          <p role="alert" className="text-center text-sm font-medium text-danger">{error}</p>
        )}

        <Button
          type="button"
          size="lg"
          fullWidth
          icon={MailCheck}
          isLoading={isSubmitting}
          loadingText="Verifying"
          onClick={() => submit()}
          disabled={code.length !== 6}
        >
          Verify and continue
        </Button>

        <div className="text-center">
          {cooldown > 0 ? (
            <p className="text-sm text-ink-muted">
              Didn't get it? You can request another in{' '}
              <span className="font-semibold tabular-nums text-ink">{cooldown}s</span>
            </p>
          ) : (
            <Button variant="link" icon={RotateCw} isLoading={isResending} onClick={resend}>
              Send me a new code
            </Button>
          )}
        </div>

        <p className="rounded-xl bg-canvas-warm px-4 py-3 text-center text-xs leading-relaxed text-ink-soft">
          Check your spam folder if it has not arrived after a minute. Never share this code — LizExpress staff will
          never ask you for it.
        </p>
      </div>
    </AuthShell>
  );
};

export default VerifyEmail;
