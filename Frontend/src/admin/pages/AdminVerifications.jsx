import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Clock, AlertTriangle, ExternalLink, RotateCw, X, Check, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Textarea, Select } from '../../components/ui/Input.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useRealtimeChannel } from '../../hooks/useRealtime.js';
import { channels } from '../../lib/supabase.js';
import { dateTime, timeAgo, REJECTION_LABELS, dateLong } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  ['pending', 'Pending'],
  ['under_review', 'In review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];

const DOCUMENT_SLOTS = [
  ['identity_document', 'ID — front'],
  ['identity_document_back', 'ID — back'],
  ['selfie_image', 'Selfie with ID'],
  ['address_document', 'Proof of address'],
];

/**
 * The review drawer.
 *
 * This is the piece that did not exist in v1. Documents live in a private
 * bucket, so the server mints a signed URL per document each time a reviewer
 * opens a submission. Those URLs expire in five minutes — the countdown is
 * shown, because a reviewer who leaves the tab open and finds broken images
 * needs to understand why rather than assume the upload failed.
 */
const ReviewPanel = ({ id, onClose, onDecided }) => {
  const toast = useToast();
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('document_illegible');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [zoomed, setZoomed] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await endpoints.admin.verification(id);
      setRecord(data);
      setExpiresIn(data.documentsExpireInSeconds ?? 300);
    } catch (error) {
      toast.error(error.message);
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [id, onClose, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (expiresIn <= 0) return undefined;
    const timer = setInterval(() => setExpiresIn((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [expiresIn]);

  const claim = async () => {
    try {
      const updated = await endpoints.admin.claimVerification(id);
      setRecord(updated);
      toast.success('Claimed. Other reviewers can see you have this one.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const decide = async () => {
    setIsSaving(true);
    try {
      await endpoints.admin.decideVerification(id, {
        decision,
        reason: decision === 'reject' ? reason : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(decision === 'approve' ? 'Approved. The applicant has been emailed.' : 'Rejected. The applicant has been told what to fix.');
      onDecided();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const requestMore = async () => {
    if (notes.trim().length < 10) {
      toast.error('Tell the applicant what is missing — at least a sentence.');
      return;
    }
    setIsSaving(true);
    try {
      await endpoints.admin.requestResubmit(id, notes.trim());
      toast.success('Resubmission requested.');
      onDecided();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={26} />
      </div>
    );
  }
  if (!record) return null;

  const applicant = record.user ?? {};
  const isDecided = ['approved', 'rejected'].includes(record.status);
  const expired = expiresIn <= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar src={applicant.avatar_url} name={applicant.full_name} size="lg" verified={applicant.is_verified} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-ink">{applicant.full_name ?? 'Unnamed applicant'}</p>
          <p className="font-mono text-xs text-ink-muted">{record.reference}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {/* Cross-check panel: the reviewer's actual job is comparing these fields
          against the document, so they sit beside the images, not on another tab. */}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-line bg-canvas-sunken p-4 text-sm sm:grid-cols-2">
        {[
          ['Document type', record.document_type?.replace(/_/g, ' ') ?? '—'],
          ['Document number', record.document_number ?? '—'],
          ['Date of birth', applicant.date_of_birth ? dateLong(applicant.date_of_birth) : '—'],
          ['Nationality', applicant.nationality ?? '—'],
          ['Address', applicant.residential_address ?? '—'],
          ['Location', [applicant.city, applicant.state, applicant.country].filter(Boolean).join(', ') || '—'],
          ['Submitted', dateTime(record.submitted_at)],
          ['Attempt', `#${record.attempt_count ?? 1}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
            <dd className="mt-0.5 break-words font-medium capitalize text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-ink-faint">Documents</h3>
          <span className={cn('flex items-center gap-1.5 text-xs font-medium', expired ? 'text-danger' : 'text-ink-muted')}>
            <Clock size={12} aria-hidden="true" />
            {expired ? 'Links expired' : `Links expire in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`}
          </span>
        </div>

        {expired ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm text-orange-900">
              The secure links have expired. Reload to view the documents again.
            </p>
            <Button size="sm" variant="outline" icon={RotateCw} onClick={load}>Reload</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DOCUMENT_SLOTS.map(([key, label]) => {
              const url = record.documents?.[key];
              return (
                <figure key={key} className="overflow-hidden rounded-xl border border-line bg-canvas-sunken">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setZoomed({ url, label })}
                      className="block w-full"
                      aria-label={`Enlarge ${label}`}
                    >
                      <img src={url} alt={label} className="h-40 w-full bg-white object-contain" />
                    </button>
                  ) : (
                    <div className="flex h-40 items-center justify-center text-xs text-ink-faint">Not provided</div>
                  )}
                  <figcaption className="flex items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
                    <span className="text-xs font-medium text-ink-soft">{label}</span>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-ink-faint transition hover:text-purple-600"
                        aria-label={`Open ${label} in a new tab`}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>

      {isDecided ? (
        <div className="rounded-xl border border-line bg-canvas-sunken p-4 text-sm">
          <p className="font-semibold text-ink">
            {record.status === 'approved' ? 'Approved' : 'Rejected'} by {record.reviewer?.full_name ?? 'a reviewer'}
          </p>
          <p className="mt-0.5 text-ink-muted">{dateTime(record.reviewed_at)}</p>
          {record.rejection_reason && (
            <p className="mt-2 text-ink-soft">
              <span className="font-medium">Reason:</span> {REJECTION_LABELS[record.rejection_reason] ?? record.rejection_reason}
            </p>
          )}
          {record.reviewer_notes && <p className="mt-1 text-ink-soft">{record.reviewer_notes}</p>}
        </div>
      ) : (
        <div className="space-y-4 border-t border-line pt-5">
          {record.status === 'pending' && (
            <Button variant="outline" fullWidth onClick={claim}>
              Claim this review
            </Button>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setDecision('approve')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition',
                decision === 'approve' ? 'border-success bg-success-soft text-success' : 'border-line text-ink-soft hover:border-success/40',
              )}
            >
              <Check size={16} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecision('reject')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition',
                decision === 'reject' ? 'border-danger bg-danger-soft text-danger' : 'border-line text-ink-soft hover:border-danger/40',
              )}
            >
              <X size={16} />
              Reject
            </button>
          </div>

          {decision === 'reject' && (
            <Select label="Why is this being rejected?" value={reason} onChange={(event) => setReason(event.target.value)} required>
              {Object.entries(REJECTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          )}

          <Textarea
            label={decision === 'reject' ? 'What should they fix?' : 'Notes (optional)'}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              decision === 'reject'
                ? 'The date of birth on the ID is not readable. Please retake the photo in better light.'
                : 'Internal notes about this review.'
            }
            hint={decision === 'reject' ? 'This text is emailed to the applicant, so write it for them.' : undefined}
            rows={3}
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={decide} isLoading={isSaving} disabled={!decision} className="flex-1">
              {decision === 'approve' ? 'Approve and notify' : decision === 'reject' ? 'Reject and notify' : 'Choose a decision'}
            </Button>
            <Button variant="outline" onClick={requestMore} isLoading={isSaving}>
              Ask for more
            </Button>
          </div>
        </div>
      )}

      <Modal open={Boolean(zoomed)} onClose={() => setZoomed(null)} title={zoomed?.label} size="xl">
        {zoomed && <img src={zoomed.url} alt={zoomed.label} className="max-h-[72vh] w-full object-contain" />}
      </Modal>
    </div>
  );
};

const AdminVerifications = () => {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      endpoints.admin.verifications({ status, page, limit: 20, search: search || undefined }),
      endpoints.admin.verificationStats().catch(() => null),
    ])
      .then(([queue, queueStats]) => {
        setRows(queue.data);
        setMeta(queue.meta);
        setStats(queueStats);
      })
      .finally(() => setIsLoading(false));
  }, [status, page, search]);

  useEffect(load, [load]);

  // New submissions appear without the reviewer needing to refresh.
  useRealtimeChannel(channels.adminFeed(), {
    'verification:submitted': load,
    'verification:decided': load,
  });

  const columns = [
    {
      key: 'applicant',
      header: 'Applicant',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={row.user?.avatar_url} name={row.user?.full_name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.user?.full_name ?? 'Unnamed'}</p>
            <p className="truncate font-mono text-2xs text-ink-faint">{row.reference}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'Document',
      render: (row) => <span className="capitalize text-ink-soft">{row.document_type?.replace(/_/g, ' ') ?? '—'}</span>,
    },
    {
      key: 'waiting',
      header: 'Waiting',
      render: (row) => (
        <span className={cn('text-ink-soft', row.status === 'pending' && 'font-medium')}>{timeAgo(row.submitted_at)}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" /> },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button size="sm" variant={row.status === 'pending' ? 'primary' : 'outline'} onClick={() => setOpenId(row.id)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Oldest submissions first. Every decision is recorded against your account."
      />

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Pending', stats.pending ?? 0, 'text-orange-600'],
            ['In review', stats.under_review ?? 0, 'text-purple-600'],
            ['Approved', stats.approved ?? 0, 'text-success'],
            ['Longest wait', `${stats.oldestWaitingHours ?? 0}h`, stats.oldestWaitingHours > 24 ? 'text-danger' : 'text-ink'],
          ].map(([label, value, tone]) => (
            <div key={label} className="card p-4">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
              <p className={cn('mt-1 font-display text-2xl font-bold', tone)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {stats?.oldestWaitingHours > 24 && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          Someone has been waiting over 24 hours. Applicants cannot list or message until they are reviewed.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" role="tablist">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition',
                status === value ? 'bg-purple-600 text-white' : 'bg-white text-ink-soft hover:bg-purple-50',
              )}
            >
              {label}
              {value === 'pending' && stats?.pending > 0 && (
                <Badge tone="accent" size="sm" className="ml-1.5">{stats.pending}</Badge>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:ml-auto sm:w-auto">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Reference or document number"
            aria-label="Search submissions"
            className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm focus:border-purple-400 focus:outline-none sm:w-64"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        meta={meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={ShieldCheck}
            title={status === 'pending' ? 'Queue is clear' : 'Nothing here'}
            description={status === 'pending' ? 'Every submission has been reviewed. Nice work.' : 'No submissions match this filter.'}
          />
        }
      />

      <Modal open={Boolean(openId)} onClose={() => setOpenId(null)} title="Review submission" size="lg">
        {openId && <ReviewPanel id={openId} onClose={() => setOpenId(null)} onDecided={load} />}
      </Modal>
    </>
  );
};

export default AdminVerifications;
