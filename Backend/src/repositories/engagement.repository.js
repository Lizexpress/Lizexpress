/**
 * Engagement data: likes, saves, comments, and the activity log behind the
 * admin Engagement page. Counters and the log are maintained by database
 * triggers (migration 0004), so this layer only ever writes the source rows
 * and reads the aggregates — it cannot let them drift apart.
 */
import { db, unwrap, range } from './base.repository.js';

const COMMENT_FIELDS = `
  id, entity_type, entity_id, user_id, parent_id, body, is_hidden, created_at,
  author:users!comments_user_id_fkey(id, full_name, avatar_url, is_verified)
`;

export const engagementRepository = {
  /* ── Reactions ── */

  async hasReaction(userId, type, id, kind) {
    const row = unwrap(
      await db
        .from('reactions')
        .select('user_id')
        .eq('user_id', userId)
        .eq('entity_type', type)
        .eq('entity_id', id)
        .eq('kind', kind)
        .maybeSingle(),
      'find reaction',
    );
    return Boolean(row);
  },

  async addReaction(userId, type, id, kind) {
    // upsert + ignoreDuplicates: a double-tap is a no-op, never an error.
    unwrap(
      await db
        .from('reactions')
        .upsert({ user_id: userId, entity_type: type, entity_id: id, kind }, { ignoreDuplicates: true }),
      'add reaction',
    );
  },

  async removeReaction(userId, type, id, kind) {
    unwrap(
      await db
        .from('reactions')
        .delete()
        .eq('user_id', userId)
        .eq('entity_type', type)
        .eq('entity_id', id)
        .eq('kind', kind),
      'remove reaction',
    );
  },

  /** Which of these ids has this user liked / saved — powers filled hearts on cards. */
  async viewerState(userId, type, ids) {
    if (!ids.length) return { liked: [], saved: [] };
    const reactions = unwrap(
      await db
        .from('reactions')
        .select('entity_id, kind')
        .eq('user_id', userId)
        .eq('entity_type', type)
        .in('entity_id', ids),
      'viewer reactions',
    ) ?? [];

    let saved = reactions.filter((row) => row.kind === 'save').map((row) => row.entity_id);
    if (type === 'item') {
      // Item saves live in the existing favorites table.
      const favorites = unwrap(
        await db.from('favorites').select('item_id').eq('user_id', userId).in('item_id', ids),
        'viewer favorites',
      ) ?? [];
      saved = favorites.map((row) => row.item_id);
    }

    return { liked: reactions.filter((row) => row.kind === 'like').map((row) => row.entity_id), saved };
  },

  /* ── Counts on the entity itself ── */

  async counts(type, id) {
    const table = type === 'advert' ? 'adverts' : 'items';
    const columns =
      type === 'advert'
        ? 'id, user_id, like_count, save_count, comment_count, share_count, view_count, contact_count'
        : 'id, user_id, like_count, favorite_count, comment_count, share_count, view_count, chat_count';
    const row = unwrap(await db.from(table).select(columns).eq('id', id).maybeSingle(), 'engagement counts');
    if (!row) return null;
    return {
      ownerId: row.user_id,
      likes: row.like_count ?? 0,
      saves: (type === 'advert' ? row.save_count : row.favorite_count) ?? 0,
      comments: row.comment_count ?? 0,
      shares: row.share_count ?? 0,
      views: row.view_count ?? 0,
      contacts: (type === 'advert' ? row.contact_count : row.chat_count) ?? 0,
    };
  },

  async record(type, id, kind, actorId = null) {
    unwrap(
      await db.rpc('record_engagement', { p_type: type, p_id: id, p_kind: kind, p_actor: actorId }),
      'record engagement',
    );
  },

  /* ── Comments ── */

  async listComments(type, id, { page, limit, includeHidden = false }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });

    // Top-level comments are paginated; their replies come along with them.
    let query = db
      .from('comments')
      .select(COMMENT_FIELDS, { count: 'exact' })
      .eq('entity_type', type)
      .eq('entity_id', id)
      .is('parent_id', null);
    if (!includeHidden) query = query.eq('is_hidden', false);

    const { data: roots, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list comments',
    );

    const rootIds = (roots ?? []).map((row) => row.id);
    let replies = [];
    if (rootIds.length) {
      let replyQuery = db.from('comments').select(COMMENT_FIELDS).in('parent_id', rootIds);
      if (!includeHidden) replyQuery = replyQuery.eq('is_hidden', false);
      replies = unwrap(await replyQuery.order('created_at', { ascending: true }), 'list replies') ?? [];
    }

    const items = (roots ?? []).map((root) => ({
      ...root,
      replies: replies.filter((reply) => reply.parent_id === root.id),
    }));

    return { items, total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async findComment(id) {
    return unwrap(await db.from('comments').select(COMMENT_FIELDS).eq('id', id).maybeSingle(), 'find comment');
  },

  async createComment(payload) {
    return unwrap(await db.from('comments').insert(payload).select(COMMENT_FIELDS).single(), 'create comment');
  },

  async deleteComment(id) {
    unwrap(await db.from('comments').delete().eq('id', id), 'delete comment');
  },

  async setHidden(id, hidden, actorId) {
    return unwrap(
      await db
        .from('comments')
        .update({ is_hidden: hidden, hidden_by: hidden ? actorId : null, hidden_at: hidden ? new Date().toISOString() : null })
        .eq('id', id)
        .select(COMMENT_FIELDS)
        .single(),
      'hide comment',
    );
  },

  /** Admin moderation feed, newest first, across every advert and item. */
  async recentComments({ page, limit, hidden }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('comments').select(COMMENT_FIELDS, { count: 'exact' });
    if (hidden !== undefined) query = query.eq('is_hidden', hidden);
    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'recent comments',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /** Titles for a mixed list of adverts and items, for the moderation feed. */
  async titles(refs) {
    const advertIds = refs.filter((ref) => ref.entity_type === 'advert').map((ref) => ref.entity_id);
    const itemIds = refs.filter((ref) => ref.entity_type === 'item').map((ref) => ref.entity_id);
    const [adverts, items] = await Promise.all([
      advertIds.length
        ? db.from('adverts').select('id, title, business_name').in('id', advertIds).then((res) => unwrap(res, 'advert titles'))
        : [],
      itemIds.length
        ? db.from('items').select('id, name').in('id', itemIds).then((res) => unwrap(res, 'item titles'))
        : [],
    ]);
    const map = new Map();
    (adverts ?? []).forEach((row) => map.set(row.id, { title: row.title, subtitle: row.business_name }));
    (items ?? []).forEach((row) => map.set(row.id, { title: row.name, subtitle: 'Swap item' }));
    return map;
  },

  /* ── Analytics (database functions, service role only) ── */

  async summary(since, ownerId = null) {
    return unwrap(await db.rpc('engagement_summary', { p_since: since, p_owner: ownerId }), 'engagement summary') ?? [];
  },

  async people(since, ownerId = null) {
    return unwrap(await db.rpc('engagement_people', { p_since: since, p_owner: ownerId }), 'engagement people') ?? 0;
  },

  async daily(days, ownerId = null) {
    return unwrap(await db.rpc('engagement_daily', { p_days: days, p_owner: ownerId }), 'engagement daily') ?? [];
  },

  async top(type, since, limit = 10) {
    return unwrap(await db.rpc('engagement_top', { p_type: type, p_since: since, p_limit: limit }), 'engagement top') ?? [];
  },

  async topOwners(since, limit = 10) {
    return unwrap(await db.rpc('engagement_top_owners', { p_since: since, p_limit: limit }), 'engagement owners') ?? [];
  },
};

export default engagementRepository;
