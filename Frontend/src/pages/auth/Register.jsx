import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, User, Lock, Check } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { cn } from '../../lib/cn.js';

/** Live password requirements. Checking as they type beats failing on submit. */
const RULES = [
  { test: (value) => value.length >= 8, label: 'At least 8 characters' },
  { test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper and lowercase letters' },
  { test: (value) => /\d/.test(value), label: 'At least one number' },
];

const Register = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ fullName: '', email: '', password: '', acceptedTerms: false });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setErrors({});

    if (!form.acceptedTerms) {
      setErrors({ acceptedTerms: 'Please accept the terms to continue.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await endpoints.auth.register(form);
      toast.success('Check your inbox for your 6-digit code.');
      // Carry the email forward so the next screen does not ask for it again.
      navigate('/verify-email', { state: { email: form.email, purpose: 'signup' } });
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
        else setErrors({ form: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start swapping in minutes"
      description="Tell us who you are. We will send a 6-digit code to confirm your email."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-purple-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errors.form && (
          <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {errors.form}
          </div>
        )}

        <Input
          label="Full name"
          icon={User}
          value={form.fullName}
          onChange={update('fullName')}
          error={errors.fullName}
          placeholder="Amina Yusuf"
          autoComplete="name"
          required
        />

        <Input
          label="Email address"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={update('email')}
          error={errors.email}
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
            error={errors.password}
            placeholder="Create a strong password"
            autoComplete="new-password"
            required
          />

          {form.password && (
            <ul className="mt-2.5 space-y-1">
              {RULES.map((rule) => {
                const passed = rule.test(form.password);
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
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={update('acceptedTerms')}
            className="mt-0.5 h-4 w-4 rounded border-line-strong text-purple-600 focus:ring-purple-400"
          />
          <span className="text-sm leading-relaxed text-ink-soft">
            I agree to the{' '}
            <Link to="/terms" className="font-medium text-purple-600 hover:underline">Terms of Service</Link> and{' '}
            <Link to="/privacy" className="font-medium text-purple-600 hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {errors.acceptedTerms && <p role="alert" className="text-sm text-danger">{errors.acceptedTerms}</p>}

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Creating your account">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
};

export default Register;
