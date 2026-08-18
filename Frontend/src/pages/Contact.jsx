import { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Input, Textarea, Select } from '../components/ui/Input.jsx';
import { endpoints, ApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const TYPES = [
  ['question', 'A question'],
  ['bug', 'Something is broken'],
  ['suggestion', 'A suggestion'],
  ['testimonial', 'Share my experience'],
  ['complaint', 'A complaint'],
];

/**
 * Contact doubles as the feedback form — /contact and /feedback both land here.
 * Splitting them would mean two forms posting to the same endpoint.
 */
const Contact = () => {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ type: 'question', message: '', email: '', rating: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await endpoints.system.feedback({
        type: form.type,
        message: form.message,
        email: isAuthenticated ? undefined : form.email || undefined,
        rating: form.rating ? Number(form.rating) : undefined,
      });
      setIsSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send that. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <div className="container-page flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <CheckCircle2 size={44} className="text-success" aria-hidden="true" />
        <h1 className="mt-5 font-display text-2xl font-semibold">Thank you</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          We have your message and will reply by email if it needs a response.
        </p>
        <Button className="mt-6" onClick={() => { setIsSent(false); setForm({ type: 'question', message: '', email: '', rating: '' }); }}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10 lg:py-16">
      <header>
        <h1 className="text-title font-bold">Get in touch</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Questions, problems, or ideas — all of it reaches the same small team in Kano.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-canvas-sunken p-5 text-sm text-ink-soft sm:flex-row sm:gap-8">
        <p className="flex items-center gap-2">
          <Mail size={15} aria-hidden="true" />
          <a href="mailto:support@lizexpressltd.com" className="hover:text-purple-700">support@lizexpressltd.com</a>
        </p>
        <p className="flex items-center gap-2">
          <MapPin size={15} aria-hidden="true" />
          Kano, Nigeria
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <Select label="What is this about?" value={form.type} onChange={setField('type')} required>
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        {!isAuthenticated && (
          <Input
            label="Your email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            hint="So we can reply."
            placeholder="you@example.com"
            required
          />
        )}

        {form.type === 'testimonial' && (
          <Select label="How would you rate LizExpress?" value={form.rating} onChange={setField('rating')}>
            <option value="">Choose a rating</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} out of 5</option>
            ))}
          </Select>
        )}

        <Textarea
          label="Your message"
          value={form.message}
          onChange={setField('message')}
          rows={6}
          placeholder={
            form.type === 'bug'
              ? 'What were you doing, and what happened instead?'
              : 'Tell us what is on your mind.'
          }
          required
        />

        {isAuthenticated && (
          <p className="text-xs text-ink-muted">
            Sending as {user?.full_name} ({user?.email}).
          </p>
        )}

        <Button type="submit" size="lg" icon={Send} isLoading={isSubmitting} loadingText="Sending">
          Send message
        </Button>
      </form>
    </div>
  );
};

export default Contact;
