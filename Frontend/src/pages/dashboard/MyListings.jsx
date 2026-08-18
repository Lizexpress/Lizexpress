import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Trash2, CheckCircle2, CreditCard } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { ItemGrid } from '../../components/items/ItemGrid.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { STATUS_LABELS } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  ['', 'All'],
  ['active', 'Live'],
  ['draft', 'Drafts'],
  ['pending_payment', 'Awaiting payment'],
  ['swapped', 'Swapped'],
];

const MyListings = () => {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setIsLoading(true);
    endpoints.items
      .mine({ status: status || undefined, limit: 40 })
      .then(({ data }) => setItems(data))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [status]);

  const remove = async () => {
    try {
      const result = await endpoints.items.remove(confirmDelete.id);
      toast.success(result.archived ? 'Listing archived.' : 'Listing deleted.');
      setConfirmDelete(null);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title font-bold">My listings</h1>
        <Button as={Link} to="/list-item" icon={Plus}>List an item</Button>
      </header>

      <div className="mb-6 flex gap-1.5 overflow-x-auto scrollbar-hide" role="tablist">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition',
              status === value ? 'bg-purple-600 text-white' : 'bg-canvas-sunken text-ink-soft hover:bg-purple-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ItemGrid
        items={items}
        isLoading={isLoading}
        showStatus
        empty={
          <EmptyState
            icon={Package}
            title={status ? `No ${STATUS_LABELS[status]?.toLowerCase() ?? ''} listings` : 'You have not listed anything yet'}
            description="List something you no longer use and say what you want in return."
            action={<Button as={Link} to="/list-item" icon={Plus}>List an item</Button>}
          />
        }
      />

      {items.length > 0 && (
        <div className="mt-8 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
              {item.status === 'draft' || item.status === 'pending_payment' ? (
                <Button as={Link} to={`/payment/callback?itemId=${item.id}&action=start`} size="sm" icon={CreditCard}>
                  Pay to publish
                </Button>
              ) : item.status === 'active' ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={CheckCircle2}
                  onClick={async () => {
                    await endpoints.items.markSwapped(item.id);
                    toast.success('Marked as swapped.');
                    load();
                  }}
                >
                  Mark swapped
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(item)} aria-label={`Delete ${item.name}`} />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this listing?"
        description={confirmDelete?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>Delete listing</Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {confirmDelete?.payment_status === 'paid'
            ? 'This listing has been paid for, so it will be archived rather than deleted. Your receipt stays valid and it will no longer appear in the marketplace.'
            : 'This cannot be undone. The listing and its photos will be removed.'}
        </p>
      </Modal>
    </div>
  );
};

export default MyListings;
