import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { RowsSkeleton } from '../../components/ui/Skeleton.jsx';
import { endpoints } from '../../lib/api.js';
import { money, dateTime } from '../../lib/format.js';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    endpoints.payments
      .history({ limit: 50 })
      .then(({ data }) => setPayments(data))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <h1 className="mb-6 text-title font-bold">Payments</h1>

      {isLoading ? (
        <RowsSkeleton count={4} />
      ) : payments.length ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">Your listing fee payments</caption>
            <thead className="border-b border-line bg-canvas-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Item</th>
                <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{payment.item?.name ?? (payment.advert ? `Advert: ${payment.advert.title}` : 'Listing fee')}</p>
                    <p className="font-mono text-2xs text-ink-faint">{payment.tx_ref}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(payment.amount, payment.currency)}</td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">{dateTime(payment.paid_at ?? payment.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={payment.status} size="sm" kind="payment" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Receipt} title="No payments yet" description="Listing fees you pay will appear here with their receipts." />
      )}
    </div>
  );
};

export default Payments;
