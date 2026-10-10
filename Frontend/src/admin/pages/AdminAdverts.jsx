import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  { value: 'pending_review', label: 'Needs approval' },
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
 * Paid adverts land in "Needs approval" (unless auto-approve is switched on in
 * Settings). Approving publishes the advert and starts its run; rejecting
 * pauses it with a reason the advertiser is emailed. Live adverts can be
 * suspended or restored here at any time.
 */
const AdminAdverts = () => {
  const toast = useToast();
  const [params] = useSearchParams();
  const [stats, setStats] = useState(null);
  // The "advert waiting for approval" email links here with ?status=&open=.
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const debouncedState = useDebounce(stateFilter, 400);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(params.get('open'));

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
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => (
        <span className={cn('mono whitespace-nowrap', Number(row.amount_paid_kobo) > 0 ? 'text-ink' : 'text-ink-faint')}>
          {Number(row.amount_paid_kobo) > 0 ? money(Number(row.amount_paid_kobo) / 100) : '—'}
        </span>
      ),
    },
    { key: 'views', header: 'Views', render: (row) => <span className="mono">{number(row.view_count)}</span> },
    {
      key: 'engagement',
      header: 'Likes / comments',
      render: (row) => (
        <span className="mono whitespace-nowrap text-ink-soft">
          {number(row.like_count ?? 0)} / {number(row.comment_count ?? 0)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" /> },
    { key: 'created', header: 'Created', render: (row) => <span className="text-ink-muted">{timeAgo(row.created_at)}</span> },
    {
      key: 'open',
      header: '',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          className={row.status === 'pending_review' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(row.id);
          }}
        >
          {row.status === 'pending_review' ? 'Approve' : 'Review'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Adverts" description="Business adverts paid for by the photo. Approve paid adverts, check what customers see, and suspend anything that breaks the rules." />

      {/* One strip of counts — each is also a filter. */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['all', 'Total', stats?.total],
          ['pending_review', 'Needs approval', stats?.review],
          ['active', 'Live', stats?.active],
          ['pending_payment', 'Awaiting payment', stats?.pending],
          ['suspended', 'Suspended', stats?.suspended],
          ['expired', 'Expired', stats?.expired],
        ].map(([key, label, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            aria-pressed={status === key}
            className={cn(
              'bg-canvas p-4 text-left transition-colors hover:bg-canvas-sunken',
              status === key && 'bg-brand-50 hover:bg-brand-50',
            )}
          >
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              {label}
              {key === 'pending_review' && Number(value) > 0 && (
                <span className="h-2 w-2 rounded-full bg-accent-500" aria-label="needs attention" />
              )}
            </p>
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
      toast.error('Give a reason. The advertiser is told why.');
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
      const wasReview = advert.status === 'pending_review';
      toast.success(
        status === 'suspended'
          ? wasReview ? 'Advert rejected. The advertiser has been emailed.' : 'Advert suspended. The advertiser has been emailed.'
          : status === 'active'
            ? wasReview ? 'Advert approved and live. The advertiser has been emailed.' : 'Advert restored.'
            : 'Advert archived.',
      );
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

          {advert.status === 'pending_review' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink">Paid {money(Number(advert.amount_paid_kobo ?? 0) / 100)}. Waiting for approval.</p>
                <p className="mt-0.5 text-ink-muted">Approving publishes it on the adverts page and starts its run.</p>
              </div>
              <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => setStatus('active')}>
                <Icon name="check" size="sm" />
                Approve and publish
              </button>
            </div>
          )}

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
              [
                'Paid',
                Number(advert.amount_paid_kobo) > 0 ? (
                  <span key="m" className="mono text-success">{money(Number(advert.amount_paid_kobo) / 100)}</span>
                ) : (
                  <span key="m" className="text-ink-muted">Not paid</span>
                ),
              ],
              ['Live since', advert.published_at && advert.status !== 'pending_review' ? dateLong(advert.published_at) : '—'],
              ['Views / calls', <span key="v" className="mono">{number(advert.view_count)} / {number(advert.contact_count)}</span>],
              ['Likes / saves', <span key="l" className="mono">{number(advert.like_count ?? 0)} / {number(advert.save_count ?? 0)}</span>],
              ['Comments / shares', <span key="c" className="mono">{number(advert.comment_count ?? 0)} / {number(advert.share_count ?? 0)}</span>],
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
              <span className="label">
                {advert.status === 'pending_review' ? 'Reason if rejecting (emailed to the advertiser)' : 'Reason (emailed to the advertiser)'}
              </span>
              <textarea
                className="field min-h-[80px] py-2"
                maxLength={500}
                placeholder="e.g. Photos show items that are not allowed on LizExpress."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {!['archived', 'pending_review'].includes(advert.status) && (
                <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('archived')}>
                  Archive
                </button>
              )}
              {['suspended', 'expired'].includes(advert.status) && Number(advert.amount_paid_kobo) > 0 && (
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('active')}>
                  Restore
                </button>
              )}
              {advert.status === 'archived' && Number(advert.amount_paid_kobo) > 0 && (
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('active')}>
                  Publish
                </button>
              )}
              {advert.status !== 'suspended' && (
                <button type="button" className="btn btn-sm bg-danger text-white" disabled={busy} onClick={() => setStatus('suspended')}>
                  {advert.status === 'pending_review' ? 'Reject' : 'Suspend'}
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
