import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { endpoints, ApiError } from '../../lib/api.js';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await endpoints.auth.forgotPassword({ email });
      /**
       * The API deliberately returns success for unknown addresses so this page
       * cannot be used to discover which emails are registered. We move on to
       * the code screen either way.
       */
      navigate('/reset-password', { state: { email } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the code. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Reset your password"
      description="Enter the email on your account and we will send you a 6-digit code."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-purple-600 hover:underline">
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Sending your code">
          Send reset code
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
