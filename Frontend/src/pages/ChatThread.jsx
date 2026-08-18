import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeChannel } from '../hooks/useRealtime.js';
import { channels } from '../lib/supabase.js';
import { messageTime, money } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const TYPING_IDLE_MS = 2200;

const ChatThread = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [theyAreTyping, setTheyAreTyping] = useState(false);

  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const wasTyping = useRef(false);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    let active = true;
    endpoints.chats
      .detail(id, { limit: 50 })
      .then(({ data }) => {
        if (!active) return;
        setChat(data.chat);
        setMessages(data.messages.items ?? data.messages);
      })
      .catch(() => navigate('/chats', { replace: true }))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!isLoading) scrollToBottom('instant');
  }, [isLoading, scrollToBottom]);

  /**
   * Live thread updates.
   * `self: false` on the channel means our own broadcast does not come back to
   * us, so the optimistic message we already rendered is never duplicated.
   */
  useRealtimeChannel(channels.chat(id), {
    'message:new': (message) => {
      setMessages((current) => (current.some((entry) => entry.id === message.id) ? current : [...current, message]));
      setTheyAreTyping(false);
      requestAnimationFrame(() => scrollToBottom());
      endpoints.chats.markRead(id).catch(() => {});
    },
    'message:read': ({ readerId }) => {
      if (readerId === user?.id) return;
      setMessages((current) => current.map((message) => ({ ...message, is_read: true })));
    },
    typing: ({ userId, isTyping }) => {
      if (userId === user?.id) return;
      setTheyAreTyping(isTyping);
    },
  });

  const onDraftChange = (event) => {
    setDraft(event.target.value);

    // Announce typing once, then announce stopping after a pause — not per keystroke.
    if (!wasTyping.current) {
      wasTyping.current = true;
      endpoints.chats.typing(id, true).catch(() => {});
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      wasTyping.current = false;
      endpoints.chats.typing(id, false).catch(() => {});
    }, TYPING_IDLE_MS);
  };

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setDraft('');
    setIsSending(true);
    clearTimeout(typingTimeout.current);
    wasTyping.current = false;

    // Optimistic message so the thread feels instant on a slow connection.
    const optimisticId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: optimisticId, content, sender_id: user.id, created_at: new Date().toISOString(), pending: true },
    ]);
    requestAnimationFrame(() => scrollToBottom());

    try {
      const saved = await endpoints.chats.send(id, { content });
      setMessages((current) => current.map((message) => (message.id === optimisticId ? saved : message)));
    } catch {
      setMessages((current) => current.map((message) => (message.id === optimisticId ? { ...message, failed: true } : message)));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) return <PageLoader label="Opening conversation" />;
  if (!chat) return null;

  const person = chat.sender_id === user?.id ? chat.receiver : chat.sender;

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
        <Link to="/chats" className="-ml-1 rounded-lg p-1.5 text-ink-soft hover:bg-canvas-sunken" aria-label="Back to messages">
          <ChevronLeft size={20} />
        </Link>
        <Avatar src={person?.avatar_url} name={person?.full_name} size="sm" verified={person?.is_verified} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{person?.full_name ?? 'LizExpress member'}</p>
          <p className="truncate text-2xs text-ink-muted">
            {theyAreTyping ? <span className="text-purple-600">typing…</span> : `About ${chat.item?.name ?? 'a listing'}`}
          </p>
        </div>
      </header>

      {chat.item && (
        <Link
          to={`/items/${chat.item.id}`}
          className="flex items-center gap-3 border-b border-line bg-canvas-warm px-4 py-2.5 transition hover:bg-orange-100/60"
        >
          {chat.item.images?.[0] && (
            <img src={chat.item.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{chat.item.name}</p>
            <p className="text-xs text-ink-muted">{money(chat.item.estimated_cost)}</p>
          </div>
          <span className="text-xs font-semibold text-purple-600">View</span>
        </Link>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain bg-canvas-sunken px-4 py-4">
        {messages.map((message) => {
          const isMine = message.sender_id === user?.id;
          return (
            <div key={message.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5 sm:max-w-[65%]',
                  isMine
                    ? 'rounded-br-md bg-purple-600 text-white'
                    : 'rounded-bl-md border border-line bg-white text-ink',
                  message.pending && 'opacity-60',
                  message.failed && 'border-danger bg-danger-soft text-danger',
                )}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.content}</p>
                <p className={cn('mt-1 text-right text-[10px]', isMine ? 'text-purple-200' : 'text-ink-faint')}>
                  {message.failed ? 'Not sent' : messageTime(message.created_at)}
                  {isMine && message.is_read && ' · Read'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-white px-4 py-3 pb-safe">
        <textarea
          value={draft}
          onChange={onDraftChange}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter breaks the line. Matches every chat app.
            if (event.key === 'Enter' && !event.shiftKey) send(event);
          }}
          rows={1}
          placeholder="Write a message"
          aria-label="Message"
          className="max-h-32 flex-1 resize-none rounded-xl border border-line-strong px-3.5 py-2.5 text-[15px] focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || isSending} aria-label="Send message" className="h-11 w-11">
          <Send size={17} />
        </Button>
      </form>
    </div>
  );
};

export default ChatThread;
