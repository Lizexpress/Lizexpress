import { useCallback, useEffect, useState } from 'react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Icon from '../ui/Icon.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useRequireSignIn } from '../../hooks/useEngagement.js';
import { timeAgo } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const PAGE_SIZE = 10;

/**
 * Public comments under an advert or item.
 *
 * Questions customers would otherwise ask in a DM ("do you deliver to Yaba?")
 * are answered once, in public, for everyone who has the same question. One
 * level of replies keeps threads readable on a phone; the owner's replies are
 * marked so customers can tell the vendor's answer from another customer's.
 */
export const Comments = ({ type, id, ownerId, onCountChange, count }) => {
  const { user } = useAuth();
  const toast = useToast();
  const requireSignIn = useRequireSignIn();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = useCallback(
    async (nextPage) => {
      setLoading(true);
      try {
        const { data, meta: pageMeta } = await endpoints.engagement.comments(type, id, { page: nextPage, limit: PAGE_SIZE });
        setItems((current) => (nextPage === 1 ? data ?? [] : [...current, ...(data ?? [])]));
        setMeta(pageMeta);
        setPage(nextPage);
      } catch {
        // A comments failure must never break the advert page around it.
      } finally {
        setLoading(false);
      }
    },
    [type, id],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const post = async (event, parentId = null, text = draft) => {
    event.preventDefault();
    if (!requireSignIn('comment')) return false;
    const body = text.trim();
    if (!body) return false;

    setPosting(true);
    try {
      const comment = await endpoints.engagement.comment(type, id, { body, ...(parentId ? { parentId } : {}) });
      if (parentId) {
        setItems((current) =>
          current.map((root) => (root.id === parentId ? { ...root, replies: [...(root.replies ?? []), comment] } : root)),
        );
        setReplyTo(null);
      } else {
        setItems((current) => [comment, ...current]);
        setMeta((current) => (current ? { ...current, total: current.total + 1 } : current));
        setDraft('');
      }
      onCountChange?.(1);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setPosting(false);
    }
  };

  const remove = async (comment) => {
    try {
      await endpoints.engagement.deleteComment(comment.id);
      const removedReplies = comment.parent_id ? 0 : (comment.replies?.length ?? 0);
      setItems((current) =>
        comment.parent_id
          ? current.map((root) => ({ ...root, replies: (root.replies ?? []).filter((reply) => reply.id !== comment.id) }))
          : current.filter((root) => root.id !== comment.id),
      );
      onCountChange?.(-(1 + removedReplies));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const canDelete = (comment) => user && (comment.user_id === user.id || ownerId === user.id);

  return (
    <section id="comments" className="scroll-mt-24" aria-labelledby="comments-title">
      <h2 id="comments-title" className="text-lg">
        Comments
        {/* Same number as the action bar: comments including replies. */}
        {(count ?? meta?.total) > 0 && (
          <span className="mono ml-2 text-base font-normal text-ink-muted">{count ?? meta.total}</span>
        )}
      </h2>

      <form onSubmit={(event) => post(event)} className="mt-4 flex items-start gap-3">
        <Avatar src={user?.avatar_url} name={user?.full_name ?? 'You'} size="sm" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`comment-${id}`} className="sr-only">Write a comment</label>
          <textarea
            id={`comment-${id}`}
            rows={2}
            maxLength={1000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => !user && requireSignIn('comment')}
            placeholder={ownerId === user?.id ? 'Add a note for customers' : 'Ask a question or leave a review'}
            className="field min-h-[72px] resize-y py-2"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-faint">Comments are public. Keep phone numbers and payments off here.</p>
            <button type="submit" className="btn-primary btn-sm" disabled={posting || !draft.trim()}>
              {posting && !replyTo ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>

      {loading && !items.length ? (
        <div className="mt-6 space-y-4" aria-hidden="true">
          {[0, 1].map((key) => (
            <div key={key} className="flex gap-3">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No comments yet. Questions you ask here help the next customer too.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {items.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                isOwner={comment.user_id === ownerId}
                canDelete={canDelete(comment)}
                onDelete={() => remove(comment)}
                onReply={() => {
                  if (requireSignIn('reply')) setReplyTo(replyTo === comment.id ? null : comment.id);
                }}
              />

              {(comment.replies?.length > 0 || replyTo === comment.id) && (
                <ul className="ml-12 mt-4 space-y-4 border-l-2 border-line pl-4">
                  {comment.replies?.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        isOwner={reply.user_id === ownerId}
                        canDelete={canDelete(reply)}
                        onDelete={() => remove(reply)}
                        compact
                      />
                    </li>
                  ))}
                  {replyTo === comment.id && (
                    <li>
                      <ReplyBox
                        posting={posting}
                        onCancel={() => setReplyTo(null)}
                        onSubmit={(event, text) => post(event, comment.id, text)}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {meta?.hasNext && (
        <button type="button" className="btn-secondary btn-sm mt-6" disabled={loading} onClick={() => load(page + 1)}>
          {loading ? 'Loading…' : 'Show more comments'}
        </button>
      )}
    </section>
  );
};

const CommentRow = ({ comment, isOwner, canDelete, onDelete, onReply, compact }) => (
  <article className="flex gap-3">
    <Link to={`/users/${comment.author?.id}`} className="shrink-0">
      <Avatar src={comment.author?.avatar_url} name={comment.author?.full_name} size={compact ? 'xs' : 'sm'} verified={comment.author?.is_verified} />
    </Link>
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <Link to={`/users/${comment.author?.id}`} className="font-medium text-ink hover:underline">
          {comment.author?.full_name ?? 'LizExpress member'}
        </Link>
        {isOwner && <span className="badge-brand">Owner</span>}
        <span className="text-ink-faint">{timeAgo(comment.created_at)}</span>
      </p>
      <p className="mt-1 whitespace-pre-line break-words text-ink-soft">{comment.body}</p>
      <div className="mt-1 flex gap-4 text-sm">
        {onReply && (
          <button type="button" onClick={onReply} className="font-medium text-ink-muted hover:text-ink">
            Reply
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete} className="text-ink-faint hover:text-danger">
            Delete
          </button>
        )}
      </div>
    </div>
  </article>
);

const ReplyBox = ({ posting, onCancel, onSubmit }) => {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        if (await onSubmit(event, text)) setText('');
      }}
      className="flex items-start gap-2"
    >
      <input
        autoFocus
        className="field h-10 min-h-0 flex-1 py-0"
        maxLength={1000}
        placeholder="Write a reply"
        aria-label="Write a reply"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      <button type="submit" className={cn('btn-primary btn-sm')} disabled={posting || !text.trim()}>
        <Icon name="send" size="sm" />
        <span className="sr-only">Send reply</span>
      </button>
    </form>
  );
};

export default Comments;
