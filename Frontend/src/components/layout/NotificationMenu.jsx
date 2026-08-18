import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, MessageCircle, ShieldCheck, CreditCard, Package, Info } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications.js';
import { timeAgo } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';
import { EmptyState } from '../ui/EmptyState.jsx';

const TYPE_ICONS = {
  message: MessageCircle,
  swap_offer: Package,
  verification: ShieldCheck,
  payment: CreditCard,
  item: Package,
  system: Info,
};

export const NotificationMenu = ({ unreadCount = 0, tone = 'light' }) => {
  const [open, setOpen] = useState(false);
  const { items, isLoading, loadItems, markRead, markAllRead } = useNotifications();
  const ref = useRef(null);

  useEffect(() => {
    const onClickAway = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  // Only fetch the list when the menu is actually opened — the badge count
  // arrives over Realtime, so the list is dead weight until it is visible.
  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className={cn(
          'relative rounded-lg p-2.5 transition',
          tone === 'dark'
            ? 'text-white hover:text-orange-500'
            : 'text-ink-soft hover:bg-purple-50 hover:text-purple-700',
        )}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-purple-600">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border border-line bg-white shadow-lift animate-fade-up sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-ink">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto overscroll-contain">
            {isLoading && !items.length ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((key) => <div key={key} className="skeleton h-14 rounded-lg" />)}
              </div>
            ) : items.length ? (
              items.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? Info;
                return (
                  <Link
                    key={item.id}
                    to={item.action_url ?? '/dashboard'}
                    onClick={() => {
                      if (!item.is_read) markRead(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-canvas-sunken',
                      !item.is_read && 'bg-orange-50/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        item.is_read ? 'bg-canvas-sunken text-ink-muted' : 'bg-purple-100 text-purple-700',
                      )}
                    >
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>
                      {item.content && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.content}</p>}
                      <p className="mt-1 text-2xs text-ink-faint">{timeAgo(item.created_at)}</p>
                    </div>
                    {!item.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />}
                  </Link>
                );
              })
            ) : (
              <EmptyState
                icon={Bell}
                title="Nothing new"
                description="Offers, messages, and updates will appear here."
                className="py-10"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;
