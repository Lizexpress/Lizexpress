import { useEffect, useState } from 'react';
import { SmartLink as Link } from '../../components/ui/SmartLink.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Image from '../../components/ui/Image.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { endpoints } from '../../lib/api.js';
import { number, dateLong } from '../../lib/format.js';
import { placeLine } from '../../lib/adverts.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_payment', label: 'Awaiting payment' },
  { key: 'expired', label: 'Expired' },
];

/** What the one action on each row should be, given where the advert is. */
const nextAction = (advert) => {
  switch (advert.status) {
    case 'draft':
      return advert.photo_count
        ? { label: 'Pay and publish', to: `/dashboard/adverts/${advert.id}?step=publish`, primary: true }
        : { label: 'Add photos', to: `/dashboard/adverts/${advert.id}?step=photos`, primary: true };
    case 'pending_payment':
      return { label: 'Finish payment', to: `/dashboard/adverts/${advert.id}?step=publish`, primary: true };
    case 'active':
      return { label: 'View', to: `/adverts/${advert.id}` };
    default:
      return { label: 'Edit', to: `/dashboard/adverts/${advert.id}` };
  }
};

const MyAdverts = () => {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => setPage(1), [status]);

  useEffect(() => {
    setLoading(true);
    endpoints.adverts
      .mine({ status: status || undefined, page, limit: 20 })
      .then(({ data, meta: pageMeta }) => {
        setRows(data ?? []);
        setMeta(pageMeta);
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">My adverts</h1>
          <p className="mt-1 text-ink-muted">Your business adverts, their status and how many people they reach.</p>
        </div>
        <Link to="/dashboard/adverts/new" className="btn-primary">
          <Icon name="add" size="sm" />
          Create advert
        </Link>
      </header>

      <div className="scroller mt-8 border-b border-line" role="tablist" aria-label="Filter by status">
        {TABS.map((tab) => (
          <button
            key={tab.key || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.key}
            onClick={() => setStatus(tab.key)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
              status === tab.key ? 'border-brand-600 font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="divide-y divide-line" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="flex gap-4 py-4">
              <div className="skeleton h-16 w-20 shrink-0 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton mt-2 h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <Icon name="campaign" size="xl" className="text-ink-faint" />
          <p className="mt-3 text-lg font-semibold text-ink">
            {status ? 'Nothing here' : 'You have no adverts yet'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            {status
              ? 'Adverts with this status will show up here.'
              : 'Show customers near you what you sell. Each photo costs ₦1,000 and your advert runs for 30 days.'}
          </p>
          {!status && (
            <Link to="/dashboard/adverts/new" className="btn-primary mt-6">Create your first advert</Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((advert) => {
            const cover = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position)[0];
            const action = nextAction(advert);
            return (
              <li key={advert.id} className="flex items-center gap-4 py-4">
                <Link to={`/dashboard/adverts/${advert.id}`} className="w-20 shrink-0 sm:w-24">
                  {cover ? (
                    <Image src={cover.url} alt="" width={200} />
                  ) : (
                    <div className="media grid place-items-center">
                      <Icon name="image" className="text-ink-faint" />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/dashboard/adverts/${advert.id}`}
                      className="truncate font-medium text-ink hover:text-brand-700"
                    >
                      {advert.title}
                    </Link>
                    <StatusBadge status={advert.status} size="sm" />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">{placeLine(advert)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="visibility" size="sm" className="text-ink-faint" />
                      <span className="mono text-ink-soft">{number(advert.view_count)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="photo_library" size="sm" className="text-ink-faint" />
                      <span className="mono text-ink-soft">{advert.photo_count}</span>
                    </span>
                    {advert.status === 'active' && advert.expires_at && (
                      <span>Until {dateLong(advert.expires_at)}</span>
                    )}
                  </p>
                </div>

                <Link
                  to={action.to}
                  className={cn('btn-sm shrink-0', action.primary ? 'btn-primary' : 'btn-secondary')}
                >
                  {action.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-ink-muted">
            Page <span className="mono">{meta.page}</span> of <span className="mono">{meta.totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default MyAdverts;
