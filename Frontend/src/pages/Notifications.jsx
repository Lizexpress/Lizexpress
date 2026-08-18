import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { RowsSkeleton } from '../components/ui/Skeleton.jsx';
import { useNotifications } from '../hooks/useNotifications.js';
import { timeAgo } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const Notifications = () => {
  const { items, isLoading, loadItems, markRead, markAllRead, counts } = useNotifications();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <div className="container-page max-w-2xl py-8 lg:py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-title font-bold">Notifications</h1>
        {counts.notifications > 0 && (
          <Button variant="ghost" size="sm" icon={CheckCheck} onClick={markAllRead}>Mark all read</Button>
        )}
      </header>

      {isLoading && !items.length ? (
        <RowsSkeleton count={5} />
      ) : items.length ? (
        <ul className="divide-y divide-line card overflow-hidden">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.action_url ?? '/dashboard'}
                onClick={() => !item.is_read && markRead(item.id)}
                className={cn('block px-4 py-4 transition hover:bg-canvas-sunken', !item.is_read && 'bg-orange-50/60')}
              >
                <div className="flex items-start gap-3">
                  {!item.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-label="Unread" />}
                  <div className={cn('min-w-0 flex-1', item.is_read && 'pl-5')}>
                    <p className="font-semibold text-ink">{item.title}</p>
                    {item.content && <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.content}</p>}
                    <p className="mt-1 text-xs text-ink-faint">{timeAgo(item.created_at)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          description="Swap offers, messages, and account updates will show up here."
        />
      )}
    </div>
  );
};

export default Notifications;
