import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { endpoints } from '../../lib/api.js';
import { dateTime } from '../../lib/format.js';

const TONE = (action) => {
  if (action.includes('approved') || action.includes('reinstated')) return 'success';
  if (action.includes('rejected') || action.includes('suspended') || action.includes('deleted')) return 'danger';
  return 'neutral';
};

const AdminAudit = () => {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    endpoints.admin
      .auditLog({ page, limit: 25 })
      .then(({ data, meta: pageMeta }) => {
        setRows(data);
        setMeta(pageMeta);
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  const columns = [
    {
      key: 'actor',
      header: 'Who',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar src={row.actor?.avatar_url} name={row.actor?.full_name} size="xs" />
          <span className="truncate text-sm text-ink">{row.actor?.full_name ?? 'System'}</span>
        </div>
      ),
    },
    { key: 'action', header: 'Action', render: (row) => <Badge tone={TONE(row.action)} size="sm">{row.action}</Badge> },
    {
      key: 'entity',
      header: 'Target',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm capitalize text-ink-soft">{row.entity_type}</p>
          <p className="truncate font-mono text-2xs text-ink-faint">{row.entity_id ?? '—'}</p>
        </div>
      ),
    },
    { key: 'ip', header: 'IP', render: (row) => <span className="font-mono text-2xs text-ink-faint">{row.ip_address ?? '—'}</span> },
    { key: 'when', header: 'When', render: (row) => <span className="text-ink-muted">{dateTime(row.created_at)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of every privileged action. Cannot be edited or deleted."
      />
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        meta={meta}
        onPageChange={setPage}
        emptyState={<EmptyState icon={ScrollText} title="No entries yet" description="Admin actions are recorded here as they happen." />}
      />
    </>
  );
};

export default AdminAudit;
