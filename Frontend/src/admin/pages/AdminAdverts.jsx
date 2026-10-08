import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Image from '../../components/ui/Image.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { money, number, timeAgo, dateLong } from '../../lib/format.js';
import { categoryLabel, priceLine } from '../../lib/adverts.js';
import { publicUrl } from '../../lib/publicUrl.js';
import { cn } from '../../lib/cn.js';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Advertisement moderation.
 *
 * Adverts go live on payment without a review queue (advert_auto_approve), so
 * this screen is for after-the-fact moderation: find an advert, see exactly
 * what customers see, and suspend it with a reason the advertiser is told.
 */
const AdminAdverts = () => {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const debouncedState = useDebounce(stateFilter, 400);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const loadStats = useCallback(() => {
    endpoints.admin.advertStats().then(setStats).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    endpoints.admin
      .adverts({
        page,
        limit: 20,
        status,
        search: debouncedSearch || undefined,
        state: debouncedState || undefined,
      })
      .then(({ data, meta: pageMeta }) => {
        setRows(data ?? []);
        setMeta(pageMeta);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, debouncedSearch, debouncedState]);

  useEffect(loadStats, [loadStats]);
  useEffect(load, [load]);
  useEffect(() => setPage(1), [status, debouncedSearch, debouncedState]);

  const columns = [
    {
      key: 'advert',
      header: 'Advert',
      render: (row) => {
        const cover = [...(row.photos ?? [])].sort((a, b) => a.position - b.position)[0];
        return (
          <div className="flex items-center gap-3">
            <div className="w-12 shrink-0">
              {cover ? (
                <Image src={cover.url} alt="" width={96} ratio="media-square" className="rounded-md" />
              ) : (
                <div className="media media-square grid place-items-center rounded-md">
                  <Icon name="image" size="sm" className="text-ink-faint" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-medium text-ink">{row.title}</p>
              <p className="truncate text-xs text-ink-muted">{row.business_name}</p>
            </div>
          </div>
        );
      },
    },
    // LGA rather than street: moderation is about where an advert is shown.
    { key: 'place', header: 'Location', render: (row) => <span className="whitespace-nowrap text-ink-soft">{row.lga}, {row.state_code ?? row.state}</span> },
    { key: 'photos', header: 'Photos', render: (row) => <span className="mono">{row.photo_count}</span> },
    { key: 'views', header: 'Views', render: (row) => <span className="mono">{number(row.view_count)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" /> },
    { key: 'created', header: 'Created', render: (row) => <span className="text-ink-muted">{timeAgo(row.created_at)}</span> },
    {
      key: 'open',
      header: '',
      className: 'text-right',
      render: (row) => (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpenId(row.id)}>
          Review
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Adverts" description="Business adverts paid for by the photo. Review what customers see and suspend anything that breaks the rules." />

      {/* One strip of counts — each is also a filter. */}
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-canvas sm:grid-cols-5">
        {[
          ['all', 'Total', stats?.total],
          ['active', 'Live', stats?.active],
          ['pending_payment', 'Awaiting payment', stats?.pending],
          ['suspended', 'Suspended', stats?.suspended],
          ['expired', 'Expired', stats?.expired],
        ].map(([key, label, value], index) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            aria-pressed={status === key}
            className={cn(
              'p-4 text-left transition-colors hover:bg-canvas-sunken',
              index > 0 && 'border-l border-line',
              index >= 2 && 'border-t border-line sm:border-t-0',
              index === 2 && 'border-l-0 sm:border-l',
              status === key && 'bg-brand-50 hover:bg-brand-50',
            )}
          >
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mono mt-1 text-xl font-medium text-ink">{stats ? number(value ?? 0) : '–'}</p>
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Icon name="search" size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            className="field pl-10"
            placeholder="Business or headline"
            aria-label="Search adverts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <input
          className="field"
          placeholder="State, e.g. Lagos"
          aria-label="Filter by state"
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
        />
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          {STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={loading}
        meta={meta}
        onPageChange={setPage}
        onRowClick={(row) => setOpenId(row.id)}
      />

      <AdvertReview
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          load();
          loadStats();
        }}
      />
    </>
  );
};

/* ───────────────────────── Review modal ───────────────────────── */

const AdvertReview = ({ id, onClose, onChanged }) => {
  const toast = useToast();
  const [advert, setAdvert] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAdvert(null);
    setReason('');
    if (!id) return;
    endpoints.admin.advert(id).then(setAdvert).catch((error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setStatus = async (status) => {
    if (status === 'suspended' && !reason.trim()) {
      toast.error('Give a reason. The advertiser is told why their advert was paused.');
      return;
    }
    setBusy(true);
    try {
      const updated = await endpoints.admin.setAdvertStatus(advert.id, {
        status,
        reason: reason.trim() || undefined,
      });
      setAdvert(updated);
      setReason('');
      toast.success(status === 'suspended' ? 'Advert suspended.' : status === 'active' ? 'Advert restored.' : 'Advert archived.');
      onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const photos = [...(advert?.photos ?? [])].sort((a, b) => a.position - b.position);
  const price = advert ? priceLine(advert, money) : null;

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={advert?.title ?? 'Advert'} description={advert?.business_name} size="xl">
      {!advert ? (
        <div className="grid gap-3 py-6">
          <div className="skeleton h-40" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={advert.status} />
            {advert.status === 'active' && (
              <a
                href={publicUrl(`/adverts/${advert.id}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                Open on the site
                <Icon name="open_in_new" size="sm" />
              </a>
            )}
          </div>

          {advert.suspended_reason && advert.status === 'suspended' && (
            <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">Suspended: {advert.suspended_reason}</p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="relative block">
                  <Image src={photo.url} alt="" width={300} ratio="media-square" />
                  {!photo.is_paid && <span className="badge absolute left-1 top-1 bg-canvas/90 text-warn">Unpaid</span>}
                </a>
              ))}
            </div>
          )}

          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{advert.description}</p>

          <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
            {[
              ['Advertiser', advert.owner?.full_name ?? '—'],
              ['Identity', advert.owner?.is_verified ? 'Verified' : 'Not verified'],
              ['Category', categoryLabel(advert.category)],
              ['Location', `${advert.lga}, ${advert.state}${advert.city ? ` (${advert.city})` : ''}`],
              ['Phone', <span key="p" className="mono">{advert.contact_phone}</span>],
              ['Price', price ?? '—'],
              ['Paid', <span key="m" className="mono">{money(Number(advert.amount_paid_kobo ?? 0) / 100)}</span>],
              ['Views / reveals', <span key="v" className="mono">{number(advert.view_count)} / {number(advert.contact_count)}</span>],
              ['Created', dateLong(advert.created_at)],
              ['Expires', advert.expires_at ? dateLong(advert.expires_at) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-line py-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-right text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl border border-line p-4">
            <label className="block">
              <span className="label">Reason (sent to the advertiser)</span>
              <textarea
                className="field min-h-[80px] py-2"
                maxLength={500}
                placeholder="e.g. Photos show items that are not allowed on LizExpress."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {advert.status !== 'archived' && (
                <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('archived')}>
                  Archive
                </button>
              )}
              {['suspended', 'expired'].includes(advert.status) && Number(advert.amount_paid_kobo) > 0 && (
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('active')}>
                  Restore
                </button>
              )}
              {advert.status !== 'suspended' && (
                <button type="button" className="btn btn-sm bg-danger text-white" disabled={busy} onClick={() => setStatus('suspended')}>
                  Suspend
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AdminAdverts;
