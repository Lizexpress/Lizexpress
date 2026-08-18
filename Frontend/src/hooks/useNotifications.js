import { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeChannel } from './useRealtime.js';
import { channels } from '../lib/supabase.js';

/**
 * Live notification and unread state for the header.
 *
 * Counts arrive two ways: fetched once on mount, then kept current by
 * `unread:update` broadcasts. No polling — a marketplace that polls every few
 * seconds burns battery on mobile for data that is almost always unchanged.
 */
export const useNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifications, messages] = await Promise.all([
        endpoints.notifications.unreadCount(),
        endpoints.chats.unreadCount(),
      ]);
      setCounts({ notifications: notifications.unread, messages: messages.unread });
    } catch {
      // A failed badge fetch is not worth surfacing to the user.
    }
  }, [isAuthenticated]);

  const loadItems = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data } = await endpoints.notifications.list({ limit: 15 });
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useRealtimeChannel(
    user ? channels.notifications(user.id) : null,
    {
      'notification:new': (notification) => {
        setItems((current) => [notification, ...current].slice(0, 20));
        setCounts((current) => ({ ...current, notifications: current.notifications + 1 }));
      },
      'unread:update': (payload) => setCounts(payload),
    },
    { enabled: isAuthenticated },
  );

  const markRead = useCallback(async (id) => {
    // Optimistic: the badge should drop the instant it is tapped.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    setCounts((current) => ({ ...current, notifications: Math.max(current.notifications - 1, 0) }));
    await endpoints.notifications.markRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setCounts((current) => ({ ...current, notifications: 0 }));
    await endpoints.notifications.markAllRead().catch(() => {});
  }, []);

  return { items, counts, isLoading, loadItems, loadCounts, markRead, markAllRead };
};
