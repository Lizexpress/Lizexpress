import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Image from '../../components/ui/Image.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { number, timeAgo } from '../../lib/format.js';
import { publicUrl } from '../../lib/publicUrl.js';
import { cn } from '../../lib/cn.js';

const RANGES = [7, 30, 90];

const KPIS = [
  { key: 'people', label: 'People engaged', hint: 'Different people who liked, saved, commented, shared, called or chatted' },
  { key: 'like', label: 'Likes', icon: 'favorite' },
  { key: 'save', label: 'Saves', icon: 'bookmark' },
  { key: 'comment', label: 'Comments', icon: 'chat_bubble' },
  { key: 'share', label: 'Shares', icon: 'share' },
  { key: 'contacts', label: 'Calls and chats', icon: 'call', hint: 'Phone numbers revealed on adverts, plus chats started on items' },
  { key: 'view', label: 'Views', icon: 'visibility' },
];

/**
 * Engagement — how customers respond to vendors and listings.
 *
 * Answers, in order: is engagement growing, who is it going to, and is any of
 * it a problem (the comment feed, where an admin can hide abuse). Owners'
 * own activity on their posts is excluded from every number here.
 */
const AdminEngagement = () => {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('advert');

  useEffect(() => {
    setLoading(true);
    endpoints.admin
      .engagement(days)
      .then(setData)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const totals = data?.summary?.totals ?? {};
  const kpiValue = (key) => {
    if (!data) return null;
    if (key === 'people') return data.summary.people;
    if (key === 'contacts') return (totals.contact?.total ?? 0) + (totals.chat?.total ?? 0);
    return totals[key]?.total ?? 0;
  };

  const change = data && data.previous.interactions > 0
    ? Math.round(((data.summary.interactions - data.previous.interactions) / data.previous.interactions) * 100)
    : null;

  return (
    <>
      <PageHeader
        title="Engagement"
        description="How customers respond to vendors and swap listings: likes, saves, comments, shares, calls and chats."
        action={
          <div className="inline-flex rounded-full border border-line bg-canvas-sunken p-1" role="group" aria-label="Time range">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                aria-pressed={days === value}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  days === value ? 'bg-canvas font-medium text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                {value} days
              </button>
            ))}
          </div>
        }
      />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-canvas sm:grid-cols-4 xl:grid-cols-7">
        {KPIS.map((kpi, index) => (
          <div
            key={kpi.key}
            title={kpi.hint}
            className={cn(
              'border-line p-4',
              index > 0 && 'border-l',
              index % 2 === 0 && 'max-sm:border-l-0',
              index >= 2 && 'max-sm:border-t',
              index % 4 === 0 && 'sm:max-xl:border-l-0',
              index >= 4 && 'sm:max-xl:border-t',
              index === 0 && 'bg-brand-50',
            )}
          >
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              {kpi.icon && <Icon name={kpi.icon} size="sm" className="text-ink-faint" />}
              {kpi.label}
            </p>
            <p className="mono mt-1 text-2xl font-medium text-ink">
              {loading ? <span className="skeleton inline-block h-6 w-12 align-middle" /> : number(kpiValue(kpi.key))}
            </p>
          </div>
        ))}
      </div>

      {/* ── Trend ── */}
      <section className="mt-6 rounded-xl border border-line bg-canvas p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">Interactions per day</h2>
          {data && (
            <p className="text-sm text-ink-muted">
              <span className="mono text-ink">{number(data.summary.interactions)}</span> in the last {days} days
              {change !== null && (
                <span className={cn('ml-2 inline-flex items-center', change >= 0 ? 'text-success' : 'text-danger')}>
                  <Icon name={change >= 0 ? 'trending_up' : 'trending_down'} size="sm" />
                  <span className="mono ml-0.5">{change > 0 ? '+' : ''}{change}%</span>
                  <span className="ml-1 text-ink-muted">vs previous {days} days</span>
                </span>
              )}
            </p>
          )}
        </div>
        {loading ? <div className="skeleton mt-6 h-48" /> : <DailyChart rows={data?.daily ?? []} />}
      </section>

      {/* ── Leaderboards ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <h2 className="text-base">Most engaging</h2>
            <div className="inline-flex rounded-full bg-canvas-sunken p-1" role="tablist">
              {[
                ['advert', 'Adverts'],
                ['item', 'Swap items'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm',
                    tab === value ? 'bg-canvas font-medium text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <TopTable rows={(tab === 'advert' ? data?.topAdverts : data?.topItems) ?? []} type={tab} loading={loading} />
        </section>

        <section className="rounded-xl border border-line bg-canvas">
          <h2 className="border-b border-line px-4 py-3 text-base sm:px-6">Top vendors and listers</h2>
          {loading ? (
            <div className="space-y-3 p-4">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-10" />)}</div>
          ) : !data?.topOwners?.length ? (
            <p className="p-6 text-sm text-ink-muted">No engagement in this period yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {data.topOwners.map((owner, index) => (
                <li key={owner.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                  <span className="mono w-4 text-sm text-ink-faint">{index + 1}</span>
                  <Avatar src={owner.avatarUrl} name={owner.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{owner.businessName || owner.name}</p>
                    {owner.businessName && <p className="truncate text-xs text-ink-muted">{owner.name}</p>}
                  </div>
                  <div className="text-right">
                    <p className="mono text-sm text-ink">{number(owner.people)}</p>
                    <p className="text-xs text-ink-muted">people</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <CommentFeed />
    </>
  );
};

/* ───────────────────────── Chart ───────────────────────── */

/**
 * One series, so no legend; the heading names it. Views run an order of
 * magnitude above interactions, so they ride in the tooltip rather than on a
 * second axis. Bars are thin with a 2px gap and rounded tops anchored to the
 * baseline; each column is a hover target taller than its bar.
 */
const DailyChart = ({ rows }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(...rows.map((row) => row.interactions), 1);
  const ticks = [0, Math.ceil(max / 2), max];
  const label = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  const step = Math.ceil(rows.length / 6);

  return (
    <div className="mt-6">
      <div className="relative flex h-48 gap-3">
        {/* y ticks — recessive */}
        <div className="mono flex flex-col-reverse justify-between pb-6 text-right text-xs text-ink-faint">
          {ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((tick) => <div key={tick} className="border-t border-dashed border-line" />)}
          </div>

          <div className="absolute inset-x-0 bottom-6 top-0 flex items-end" style={{ gap: rows.length > 40 ? 1 : 2 }}>
            {rows.map((row, index) => (
              <div
                key={row.day}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={cn('w-full rounded-t transition-colors', hover === index ? 'bg-brand-700' : 'bg-brand-600')}
                  style={{ height: `${(row.interactions / max) * 100}%`, minHeight: row.interactions ? 2 : 0 }}
                />
              </div>
            ))}
          </div>

          {/* Labels are positioned, not flowed, so "14 Sept" never wraps under a bar. */}
          <div className="absolute inset-x-0 bottom-0 h-5" aria-hidden="true">
            {rows.map((row, index) =>
              index % step === 0 ? (
                <span
                  key={row.day}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-ink-faint"
                  style={{ left: `${((index + 0.5) / rows.length) * 100}%` }}
                >
                  {label(row.day)}
                </span>
              ) : null,
            )}
          </div>

          {hover !== null && rows[hover] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-canvas px-3 py-2 text-sm shadow-lift"
              style={{
                // Pinned to the top of the plot, so it never covers the heading.
                left: `${Math.min(Math.max(((hover + 0.5) / rows.length) * 100, 8), 92)}%`,
                top: 0,
              }}
            >
              <p className="font-medium text-ink">{label(rows[hover].day)}</p>
              <p className="text-ink-soft"><span className="mono text-ink">{number(rows[hover].interactions)}</span> interactions</p>
              <p className="text-ink-soft"><span className="mono text-ink">{number(rows[hover].views)}</span> views</p>
            </div>
          )}
        </div>
      </div>

      {/* Table view for screen readers. */}
      <table className="sr-only">
        <caption>Interactions and views per day</caption>
        <thead><tr><th>Day</th><th>Interactions</th><th>Views</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}><td>{row.day}</td><td>{row.interactions}</td><td>{row.views}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ───────────────────────── Leaderboard ───────────────────────── */

const TopTable = ({ rows, type, loading }) => {
  if (loading) return <div className="space-y-3 p-4">{[0, 1, 2, 3].map((key) => <div key={key} className="skeleton h-12" />)}</div>;
  if (!rows.length) return <p className="p-6 text-sm text-ink-muted">No engagement in this period yet.</p>;

  const cols = [
    ['people', 'People'],
    ['likes', 'Likes'],
    ['saves', 'Saves'],
    ['comments', 'Comments'],
    ['contacts', type === 'advert' ? 'Calls' : 'Chats'],
    ['views', 'Views'],
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium sm:px-6">{type === 'advert' ? 'Advert' : 'Item'}</th>
            {cols.map(([key, label]) => (
              <th key={key} scope="col" className="px-2 py-2 text-right font-medium">{label}</th>
            ))}
            <th scope="col" className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 shrink-0">
                    <Image src={row.cover} alt="" width={80} ratio="media-square" className="rounded-md" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{row.title}</p>
                    <p className="truncate text-xs text-ink-muted">{type === 'advert' ? row.subtitle : row.ownerName}</p>
                  </div>
                </div>
              </td>
              {cols.map(([key]) => (
                <td key={key} className={cn('mono px-2 py-3 text-right', key === 'people' ? 'text-ink' : 'text-ink-soft')}>
                  {number(row[key])}
                </td>
              ))}
              <td className="pr-4 text-right sm:pr-6">
                <a
                  href={publicUrl(type === 'advert' ? `/adverts/${row.id}` : `/items/${row.id}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${row.title}`}
                  className="text-ink-faint hover:text-brand-600"
                >
                  <Icon name="open_in_new" size="sm" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ───────────────────────── Comment moderation ───────────────────────── */

const CommentFeed = () => {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    endpoints.admin
      .engagementComments({ page, limit: 15, hidden: filter === 'all' ? undefined : String(filter === 'hidden') })
      .then(({ data, meta: pageMeta }) => {
        setRows(data ?? []);
        setMeta(pageMeta);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  useEffect(load, [load]);

  const setHidden = async (comment, hidden) => {
    try {
      await endpoints.admin.hideComment(comment.id, hidden);
      setRows((current) => current.map((row) => (row.id === comment.id ? { ...row, is_hidden: hidden } : row)));
      toast.success(hidden ? 'Comment hidden.' : 'Comment restored.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-line bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-base">Latest comments</h2>
          <p className="text-xs text-ink-muted">Hide anything abusive, spam or sharing personal details.</p>
        </div>
        <select
          className="field h-9 min-h-0 w-auto py-0 text-sm"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
          aria-label="Filter comments"
        >
          <option value="all">All comments</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3 p-4">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-14" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-ink-muted">No comments yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((comment) => (
            <li key={comment.id} className={cn('flex gap-3 px-4 py-4 sm:px-6', comment.is_hidden && 'bg-canvas-sunken')}>
              <Avatar src={comment.author?.avatar_url} name={comment.author?.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium text-ink">{comment.author?.full_name ?? 'Member'}</span>
                  <span className="text-ink-faint">on</span>
                  <a
                    href={publicUrl(`/${comment.entity_type === 'advert' ? 'adverts' : 'items'}/${comment.entity_id}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-brand-600 hover:underline"
                  >
                    {comment.target?.title ?? (comment.entity_type === 'advert' ? 'an advert' : 'an item')}
                  </a>
                  <span className="text-ink-faint">{timeAgo(comment.created_at)}</span>
                  {comment.parent_id && <span className="badge-neutral">Reply</span>}
                  {comment.is_hidden && <span className="badge-danger">Hidden</span>}
                </p>
                <p className={cn('mt-1 break-words', comment.is_hidden ? 'text-ink-muted line-through' : 'text-ink-soft')}>{comment.body}</p>
              </div>
              <button
                type="button"
                className={cn('btn-sm shrink-0 self-start', comment.is_hidden ? 'btn-secondary' : 'btn-ghost text-danger')}
                onClick={() => setHidden(comment, !comment.is_hidden)}
              >
                {comment.is_hidden ? 'Restore' : 'Hide'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-6">
          <p className="text-sm text-ink-muted">
            Page <span className="mono">{meta.page}</span> of <span className="mono">{meta.totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button type="button" className="btn-secondary btn-sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminEngagement;
