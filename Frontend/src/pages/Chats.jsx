import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { RowsSkeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { messageTime } from '../lib/format.js';

const Chats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      endpoints.chats
        .list({ limit: 50 })
        .then(({ data }) => setChats(data))
        .catch(() => {})
        .finally(() => setIsLoading(false));
    load();

    // The inbox order and previews go stale while the phone is locked;
    // refresh whenever the person comes back to it.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, []);

  const otherParty = (chat) => (chat.sender_id === user?.id ? chat.receiver : chat.sender);

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <h1 className="mb-6 text-title font-bold">Messages</h1>

      {isLoading ? (
        <RowsSkeleton count={5} />
      ) : chats.length ? (
        <ul className="divide-y divide-line card overflow-hidden">
          {chats.map((chat) => {
            const person = otherParty(chat);
            return (
              <li key={chat.id}>
                <Link to={`/chats/${chat.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas-sunken">
                  <Avatar src={person?.avatar_url} name={person?.full_name} verified={person?.is_verified} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-semibold text-ink">{person?.full_name ?? 'LizExpress member'}</p>
                      <span className="shrink-0 text-2xs text-ink-faint">{messageTime(chat.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs text-ink-muted">About {chat.item?.name ?? 'a listing'}</p>
                    {chat.last_message_preview && (
                      <p className="mt-0.5 truncate text-sm text-ink-soft">{chat.last_message_preview}</p>
                    )}
                  </div>
                  {chat.item?.images?.[0] && (
                    <img src={chat.item.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="When you propose a swap on someone's listing, the conversation appears here."
          action={<Button as={Link} to="/browse">Find something to swap</Button>}
        />
      )}
    </div>
  );
};

export default Chats;
