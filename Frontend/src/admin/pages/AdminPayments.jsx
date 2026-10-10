import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { endpoints } from '../../lib/api.js';
import { money, dateTime } from '../../lib/format.js';

const AdminPayments = () => {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    endpoints.admin
      .payments({ page, limit: 20 })
      .then(({ data, meta: pageMeta }) => {
        setRows(data);
        setMeta(pageMeta);
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  const columns = [
    {
      key: 'ref',
      header: 'Reference',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-ink">{row.tx_ref}</p>
          <p className="truncate text-2xs text-ink-faint">{row.item?.name ?? (row.advert ? `Advert: ${row.advert.title}` : 'Listing fee')}</p>
        </div>
      ),
    },
    { key: 'member', header: 'Member', render: (row) => <span className="text-ink-soft">{row.user?.full_name ?? '—'}</span> },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-semibold">{money(row.amount, row.currency)}</span> },
    { key: 'method', header: 'Method', render: (row) => <span className="capitalize text-ink-muted">{row.payment_method ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" kind="payment" /> },
    { key: 'date', header: 'Date', render: (row) => <span className="text-ink-muted">{dateTime(row.paid_at ?? row.created_at)}</span> },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Every listing fee and advert payment, verified server-side against Flutterwave." />
      <DataTable columns={columns} rows={rows} isLoading={isLoading} meta={meta} onPageChange={setPage} />
    </>
  );
};

export default AdminPayments;
