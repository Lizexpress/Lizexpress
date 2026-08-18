import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { timeAgo } from '../../lib/format.js';

const AdminFeedback = () => {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    endpoints.admin
      .feedback({ page, limit: 20 })
      .then(({ data, meta: pageMeta }) => {
        setRows(data);
        setMeta(pageMeta);
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  useEffect(load, [load]);

  const moderate = async (row, status) => {
    await endpoints.admin.updateFeedback(row.id, { status }).catch(() => {});
    toast.success(status === 'approved' ? 'Published to the landing page.' : 'Dismissed.');
    load();
  };

  const columns = [
    {
      key: 'message',
      header: 'Feedback',
      render: (row) => (
        <div className="min-w-0 max-w-md">
          <p className="text-sm text-ink">{row.message}</p>
          <p className="mt-0.5 text-2xs text-ink-faint">
            {row.user?.full_name ?? 'Anonymous'} · {timeAgo(row.created_at)}
          </p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Badge tone="muted" size="sm">{row.type}</Badge> },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) =>
        row.rating ? (
          <span className="flex items-center gap-1 text-sm">
            <Star size={13} className="fill-orange-400 text-orange-400" />
            {row.rating}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'approved' ? 'success' : row.status === 'dismissed' ? 'muted' : 'warning'} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.status === 'new' ? (
          <div className="flex justify-end gap-1.5">
            {row.is_testimonial && (
              <Button size="sm" onClick={() => moderate(row, 'approved')}>Publish</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => moderate(row, 'dismissed')}>Dismiss</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Feedback" description="Bug reports, suggestions, and testimonials awaiting moderation." />
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        meta={meta}
        onPageChange={setPage}
        emptyState={<EmptyState icon={MessageSquare} title="No feedback yet" description="Submissions from the site appear here." />}
      />
    </>
  );
};

export default AdminFeedback;
