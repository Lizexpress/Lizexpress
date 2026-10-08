import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SmartLink as Link } from '../../components/ui/SmartLink.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { number } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

/**
 * Dashboard.
 *
 * Shaped by what the person chose at onboarding. A swapper sees listings and
 * messages; an advertiser sees reach — views and phone reveals — because that
 * is what they paid for; someone who chose both sees both. Each side offers the
 * other in one quiet line rather than a banner.
 *
 * Numbers sit in one strip per section, divided by hairlines, rather than a
 * card per number — four boxes saying four numbers is noise.
 */
const Dashboard = () => {
  const { user, isVerified, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    endpoints.users
      .dashboard()
      .then(setSummary)
      .catch(() => setSummary({}))
      .finally(() => setLoading(false));
  }, []);

  const types = user?.account_types?.length ? user.account_types : ['swapper'];
  const swaps = types.includes('swapper');
  const ads = types.includes('advertiser');
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  // Verify → list is a real dependency chain for swapping, so it is numbered,
  // shown only to swappers, and only until it is done.
  const setup = swaps
    ? [
        { done: isVerified, label: 'Verify your identity', hint: 'Needed before you can list or message.', to: '/id-verification' },
        { done: (summary?.totalListings ?? 0) > 0, label: 'List your first item', hint: 'Say what you have and what you want for it.', to: '/list-item' },
      ]
    : [];
  const setupLeft = setup.filter((step) => !step.done);

  return (
    <div className="container-page max-w-5xl py-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title">Hello, {firstName}</h1>
          <p className="mt-1 text-ink-muted">
            {ads && swaps
              ? 'Your swaps and your adverts, in one place.'
              : ads
                ? 'How your adverts are doing.'
                : 'Here is where your swaps stand.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {swaps && (
            <Link to="/list-item" className={ads ? 'btn-secondary' : 'btn-primary'}>
              <Icon name="add" size="sm" />
              List an item
            </Link>
          )}
          {ads && (
            <Link to="/dashboard/adverts/new" className="btn-primary">
              <Icon name="campaign" size="sm" />
              Create advert
            </Link>
          )}
        </div>
      </header>

      {!loading && setupLeft.length > 0 && (
        <section className="mt-8 rounded-xl border border-line bg-canvas" aria-labelledby="setup-title">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <h2 id="setup-title" className="text-base">Finish setting up</h2>
            <span className="mono text-sm text-ink-muted">
              {setup.length - setupLeft.length}/{setup.length}
            </span>
          </div>
          <ol className="divide-y divide-line">
            {setup.map((step, index) => (
              <li key={step.label} className="flex items-center gap-4 px-4 py-4 sm:px-6">
                <span
                  className={cn(
                    'mono grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm',
                    step.done ? 'bg-success text-white' : 'bg-brand-50 text-brand-700',
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <Icon name="check" size="sm" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', step.done ? 'text-ink-muted line-through' : 'text-ink')}>{step.label}</p>
                  {!step.done && <p className="text-sm text-ink-muted">{step.hint}</p>}
                </div>
                {!step.done && <Link to={step.to} className="btn-secondary btn-sm shrink-0">Start</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {swaps && (
        <Section
          title="Swapping"
          action={<Link to="/dashboard/listings" className="text-sm font-medium text-brand-600 hover:text-brand-700">My listings</Link>}
        >
          <StatStrip
            loading={loading}
            stats={[
              { label: 'Live listings', value: summary?.activeListings, to: '/dashboard/listings' },
              { label: 'Unread messages', value: summary?.unreadMessages, to: '/chats', highlight: summary?.unreadMessages > 0 },
              { label: 'Saved items', value: summary?.savedItems, to: '/dashboard/favorites' },
              { label: 'Completed swaps', value: summary?.swapped, to: '/dashboard/listings' },
            ]}
          />
        </Section>
      )}

      {ads && (
        <Section
          title="Advertising"
          action={<Link to="/dashboard/adverts" className="text-sm font-medium text-brand-600 hover:text-brand-700">My adverts</Link>}
        >
          <StatStrip
            loading={loading}
            stats={[
              { label: 'Live adverts', value: summary?.activeAdverts, to: '/dashboard/adverts' },
              { label: 'Views', value: summary?.advertViews, to: '/dashboard/adverts' },
              { label: 'Phone reveals', value: summary?.advertContacts, to: '/dashboard/adverts' },
              { label: 'Not yet live', value: summary?.draftAdverts, to: '/dashboard/adverts', highlight: summary?.draftAdverts > 0 },
            ]}
          />
          {!loading && summary?.draftAdverts > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
              <Icon name="info" size="sm" className="mt-0.5 text-accent-600" />
              <span>
                <span className="mono">{summary.draftAdverts}</span>{' '}
                {summary.draftAdverts === 1 ? 'advert is' : 'adverts are'} waiting for photos or payment.{' '}
                <Link to="/dashboard/adverts" className="font-medium text-brand-600 hover:underline">
                  Finish {summary.draftAdverts === 1 ? 'it' : 'them'}
                </Link>
              </span>
            </p>
          )}
          {!loading && (summary?.totalAdverts ?? 0) === 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              You have no adverts yet.{' '}
              <Link to="/dashboard/adverts/new" className="font-medium text-brand-600 hover:underline">Create your first one.</Link>{' '}
              <span className="mono">₦1,000</span> per photo, live for 30 days.
            </p>
          )}
        </Section>
      )}

      <Section title="Shortcuts">
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {[
            { to: '/chats', icon: 'chat_bubble', label: 'Messages', show: swaps },
            { to: '/adverts', icon: 'storefront', label: 'Browse adverts near you', show: true },
            { to: '/browse', icon: 'swap_horiz', label: 'Browse items to swap', show: true },
            { to: '/notifications', icon: 'notifications', label: 'Notifications', show: true },
            { to: '/dashboard/payments', icon: 'receipt_long', label: 'Payments and receipts', show: true },
            { to: '/id-verification', icon: 'verified', label: isVerified ? 'Identity verified' : 'Verify your identity', show: true },
            { to: '/settings', icon: 'settings', label: 'Account settings', show: true },
          ]
            .filter((entry) => entry.show)
            .map((entry) => (
              <li key={entry.to} className="border-b border-line">
                <Link to={entry.to} className="group flex items-center gap-3 py-3 text-ink-soft hover:text-ink">
                  <Icon name={entry.icon} className="text-ink-faint group-hover:text-brand-600" />
                  <span className="flex-1">{entry.label}</span>
                  <Icon name="chevron_right" size="sm" className="text-ink-faint" />
                </Link>
              </li>
            ))}
        </ul>
      </Section>

      {!ads && (
        <OfferRow
          icon="storefront"
          title="Run a business?"
          body="Advertise your products to customers in your area."
          to="/dashboard/adverts/new"
          cta="Create an advert"
        />
      )}
      {!swaps && (
        <OfferRow
          icon="swap_horiz"
          title="Have things you no longer use?"
          body="Swap them for things you need, without cash."
          cta="Start swapping"
          onClick={async () => {
            // Advertising enrols itself when the first advert is created;
            // swapping has no such moment, so it is switched on here.
            await endpoints.auth.completeOnboarding({ accountTypes: [...types, 'swapper'] }).catch(() => {});
            await refreshUser().catch(() => {});
            navigate('/list-item');
          }}
        />
      )}
    </div>
  );
};

const Section = ({ title, action, children }) => (
  <section className="mt-12">
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-lg">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const StatStrip = ({ stats, loading }) => (
  <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-canvas md:grid-cols-4">
    {stats.map((stat, index) => (
      <Link
        key={stat.label}
        to={stat.to}
        className={cn(
          'block p-4 transition-colors hover:bg-canvas-sunken sm:p-6',
          index % 2 === 1 && 'border-l border-line',
          index >= 2 && 'border-t border-line md:border-t-0',
          index >= 1 && 'md:border-l',
        )}
      >
        <p className="text-sm text-ink-muted">{stat.label}</p>
        <p className={cn('mono mt-1 text-2xl font-medium', stat.highlight ? 'text-brand-600' : 'text-ink')}>
          {loading ? <span className="skeleton inline-block h-6 w-10 align-middle" /> : number(stat.value ?? 0)}
        </p>
      </Link>
    ))}
  </div>
);

const OfferRow = ({ icon, title, body, to, cta, onClick }) => (
  <section className="mt-12 flex flex-col gap-4 rounded-xl bg-canvas-sunken p-4 sm:flex-row sm:items-center sm:p-6">
    <Icon name={icon} size="lg" className="text-brand-600" />
    <div className="flex-1">
      <p className="font-medium text-ink">{title}</p>
      <p className="text-sm text-ink-muted">{body}</p>
    </div>
    {onClick ? (
      <button type="button" onClick={onClick} className="btn-secondary shrink-0">{cta}</button>
    ) : (
      <Link to={to} className="btn-secondary shrink-0">{cta}</Link>
    )}
  </section>
);

export default Dashboard;
