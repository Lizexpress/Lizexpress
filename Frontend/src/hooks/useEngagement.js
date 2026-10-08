import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY = { likes: 0, saves: 0, comments: 0, shares: 0, views: 0, contacts: 0 };

/** Sends signed-out visitors to sign in and brings them back here afterwards. */
export const useRequireSignIn = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  return useCallback(
    (action) => {
      if (isAuthenticated) return true;
      toast.info(`Sign in to ${action}.`);
      navigate('/login', { state: { from: location } });
      return false;
    },
    [isAuthenticated, navigate, location, toast],
  );
};

/**
 * Engagement for one advert or item: counts, whether the viewer liked/saved
 * it, and optimistic toggles. Taps feel instant; if the server disagrees, the
 * server's numbers win.
 */
export const useEngagement = (type, id, initialCounts) => {
  const { isAuthenticated } = useAuth();
  const requireSignIn = useRequireSignIn();
  const toast = useToast();
  const [state, setState] = useState({ counts: { ...EMPTY, ...initialCounts }, liked: false, saved: false, isOwner: false });
  const busy = useRef({ like: false, save: false });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    endpoints.engagement
      .state(type, id)
      .then((data) => alive && setState(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type, id, isAuthenticated]);

  const toggle = useCallback(
    async (kind) => {
      if (!requireSignIn(kind === 'like' ? 'like this' : 'save this')) return;
      if (busy.current[kind]) return;
      busy.current[kind] = true;

      const flag = kind === 'like' ? 'liked' : 'saved';
      const counter = kind === 'like' ? 'likes' : 'saves';
      setState((current) => ({
        ...current,
        [flag]: !current[flag],
        counts: { ...current.counts, [counter]: Math.max(current.counts[counter] + (current[flag] ? -1 : 1), 0) },
      }));

      try {
        const result = await endpoints.engagement[kind](type, id);
        setState((current) => ({ ...current, [flag]: result.active, counts: { ...current.counts, ...result.counts } }));
      } catch (error) {
        setState((current) => ({
          ...current,
          [flag]: !current[flag],
          counts: { ...current.counts, [counter]: Math.max(current.counts[counter] + (current[flag] ? -1 : 1), 0) },
        }));
        toast.error(error.message);
      } finally {
        busy.current[kind] = false;
      }
    },
    [type, id, requireSignIn, toast],
  );

  const share = useCallback(
    async ({ title }) => {
      const url = window.location.href;
      let shared = false;
      if (navigator.share) {
        shared = await navigator.share({ title, url }).then(() => true).catch(() => false);
      } else {
        shared = await navigator.clipboard.writeText(url).then(() => true).catch(() => false);
        if (shared) toast.success('Link copied.');
      }
      if (!shared) return;
      setState((current) => ({ ...current, counts: { ...current.counts, shares: current.counts.shares + 1 } }));
      endpoints.engagement.share(type, id).catch(() => {});
    },
    [type, id, toast],
  );

  const setCommentCount = useCallback(
    (delta) => setState((current) => ({ ...current, counts: { ...current.counts, comments: Math.max(current.counts.comments + delta, 0) } })),
    [],
  );

  return { ...state, toggleLike: () => toggle('like'), toggleSave: () => toggle('save'), share, setCommentCount };
};

/**
 * Which cards on screen the viewer has liked/saved — one request per grid,
 * not one per card. Signed-out visitors simply see empty hearts.
 */
export const useViewerReactions = (type, ids) => {
  const { isAuthenticated } = useAuth();
  const requireSignIn = useRequireSignIn();
  const [liked, setLiked] = useState(() => new Set());
  const [saved, setSaved] = useState(() => new Set());
  const key = ids.join(',');

  useEffect(() => {
    if (!isAuthenticated || !ids.length) return;
    let alive = true;
    endpoints.engagement
      .viewerState(type, ids)
      .then((data) => {
        if (!alive) return;
        setLiked(new Set(data.liked));
        setSaved(new Set(data.saved));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, key, isAuthenticated]);

  const flip = (setter, id) =>
    setter((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /** Returns the new state so the card can adjust its own count. */
  const toggleLike = useCallback(
    async (id) => {
      if (!requireSignIn('like this')) return null;
      flip(setLiked, id);
      try {
        const result = await endpoints.engagement.like(type, id);
        setLiked((current) => {
          const next = new Set(current);
          result.active ? next.add(id) : next.delete(id);
          return next;
        });
        return result;
      } catch {
        flip(setLiked, id);
        return null;
      }
    },
    [type, requireSignIn],
  );

  const toggleSave = useCallback(
    async (id) => {
      if (!requireSignIn('save this')) return null;
      flip(setSaved, id);
      try {
        return await endpoints.engagement.save(type, id);
      } catch {
        flip(setSaved, id);
        return null;
      }
    },
    [type, requireSignIn],
  );

  return { liked, saved, toggleLike, toggleSave };
};
