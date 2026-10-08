import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { LocationFields } from '../../components/adverts/LocationFields.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../lib/cn.js';

const OPTIONS = [
  {
    value: 'swapper',
    icon: 'swap_horiz',
    title: 'Swap items',
    body: 'List things you no longer need and trade them for things you want. No cash involved.',
  },
  {
    value: 'advertiser',
    icon: 'storefront',
    title: 'Advertise my business',
    body: 'Show your products or services with photos to customers in your state and local government.',
  },
];

/**
 * First-run choice: swapping, advertising, or both.
 *
 * Both options are checkboxes, not radios — "both" is a real answer and the
 * most common one for traders who also run a shop. The dashboard is shaped by
 * this choice, and either side can be switched on later from the dashboard.
 *
 * Only new accounts see this. Accounts that existed before advertising launched
 * were marked complete by the migration and go straight to their dashboard.
 */
const Onboarding = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [types, setTypes] = useState(() => user?.account_types?.length ? user.account_types : ['swapper']);
  const [business, setBusiness] = useState({ name: user?.business_name ?? '', phone: user?.phone ?? '' });
  const [location, setLocation] = useState({ stateCode: '', state: user?.state ?? '', lga: '', city: user?.city ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const advertising = types.includes('advertiser');
  const toggle = (value) =>
    setTypes((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));

  const submit = async (event) => {
    event.preventDefault();
    if (!types.length) return setError('Choose at least one option to continue.');
    setError('');
    setSaving(true);
    try {
      const businessPayload = advertising
        ? Object.fromEntries(
            Object.entries({
              name: business.name.trim(),
              phone: business.phone.replace(/[\s-]/g, ''),
              state: location.state,
              lga: location.lga.trim(),
              city: location.city.trim(),
            }).filter(([, value]) => value),
          )
        : undefined;

      await endpoints.auth.completeOnboarding({
        accountTypes: types,
        ...(businessPayload && Object.keys(businessPayload).length ? { business: businessPayload } : {}),
      });
      await refreshUser();
      navigate(advertising && !types.includes('swapper') ? '/dashboard/adverts/new' : '/dashboard', { replace: true });
    } catch (err) {
      const fieldMessage = Object.values(err.fieldErrors ?? {})[0];
      setError(fieldMessage ?? err.message);
      setSaving(false);
    }
  };

  const firstName = user?.full_name?.split(' ')[0];

  return (
    <div className="min-h-dvh bg-canvas-sunken">
      <div className="container-page max-w-2xl py-8">
        <Logo variant="dark" />

        <form onSubmit={submit} className="mt-12 sm:mt-16">
          <h1 className="text-title">{firstName ? `Welcome, ${firstName}.` : 'Welcome.'} How will you use LizExpress?</h1>
          <p className="mt-3 text-ink-muted">Choose one or both. You can add the other any time from your dashboard.</p>

          <fieldset className="mt-8 grid gap-3">
            <legend className="sr-only">Account type</legend>
            {OPTIONS.map((option) => {
              const selected = types.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-4 rounded-xl border bg-canvas p-4 transition-colors sm:p-6',
                    selected ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line-strong hover:border-ink-faint',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggle(option.value)}
                  />
                  <span
                    className={cn(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-lg transition-colors',
                      selected ? 'bg-brand-600 text-white' : 'bg-canvas-sunken text-ink-soft',
                    )}
                  >
                    <Icon name={option.icon} size="lg" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold text-ink">{option.title}</span>
                    <span className="mt-1 block text-ink-muted">{option.body}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
                      selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong',
                    )}
                  >
                    {selected && <Icon name="check" size="sm" />}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {advertising && (
            <section className="mt-8 animate-fade-up rounded-xl border border-line bg-canvas p-4 sm:p-6">
              <h2 className="text-lg">Your business</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Optional now. We will fill these into your first advert so you do not type them twice.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Business name</span>
                  <input
                    className="field"
                    value={business.name}
                    maxLength={140}
                    onChange={(event) => setBusiness((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="label">Business phone</span>
                  <input
                    className="field mono"
                    type="tel"
                    inputMode="tel"
                    placeholder="0803 123 4567"
                    value={business.phone}
                    onChange={(event) => setBusiness((current) => ({ ...current, phone: event.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-4">
                <LocationFields value={location} onChange={setLocation} requireLga={false} />
              </div>
            </section>
          )}

          {error && (
            <p role="alert" className="error mt-6 rounded-lg bg-danger-soft p-3">
              <Icon name="error" size="sm" />
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving || !types.length}>
              {saving ? 'Setting up…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
