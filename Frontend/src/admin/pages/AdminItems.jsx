import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Textarea, Select } from '../../components/ui/Input.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { money, timeAgo } from '../../lib/format.js';

const AdminItems = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nextStatus, setNextStatus] = useState('suspended');
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    setIsLoading(true);
    endpoints.admin
      .items({ page, limit: 20, q: debouncedSearch || undefined })
      .then(({ data, meta: pageMeta }) => {
        setRows(data);
        setMeta(pageMeta);
      })
      .finally(() => setIsLoading(false));
  }, [page, debouncedSearch]);

  useEffect(load, [load]);

  const applyStatus = async () => {
    try {
      await endpoints.admin.setItemStatus(selected.id, { status: nextStatus, reason: reason.trim() || undefined });
      toast.success('Listing updated.');
      setSelected(null);
      setReason('');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    {
      key: 'item',
      header: 'Listing',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.images?.[0] && <img src={row.images[0]} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" />}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.name}</p>
            <p className="truncate text-2xs text-ink-faint">{row.category}</p>
          </div>
        </div>
      ),
    },
    { key: 'owner', header: 'Owner', render: (row) => <span className="text-ink-soft">{row.owner?.full_name ?? '—'}</span> },
    { key: 'value', header: 'Value', render: (row) => <span className="font-medium">{money(row.estimated_cost)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" /> },
    { key: 'listed', header: 'Listed', render: (row) => <span className="text-ink-muted">{timeAgo(row.created_at)}</span> },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button as={Link} to={`/items/${row.id}`} size="sm" variant="ghost" aria-label="View listing">
            <ExternalLink size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>Moderate</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Listings" description="Review and moderate everything on the marketplace." />

      <div className="relative mb-5 max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search listings"
          aria-label="Search listings"
          className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm focus:border-purple-400 focus:outline-none"
        />
      </div>

      <DataTable columns={columns} rows={rows} isLoading={isLoading} meta={meta} onPageChange={setPage} />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Moderate listing"
        description={selected?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={applyStatus}>Apply</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Set status to" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
            <option value="active">Live</option>
            <option value="suspended">Removed</option>
            <option value="archived">Archived</option>
          </Select>
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="Sent to the owner when a listing is removed."
            rows={3}
          />
        </div>
      </Modal>
    </>
  );
};

export default AdminItems;
