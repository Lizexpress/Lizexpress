/**
 * Engagement — the Instagram-style layer on adverts and swap items.
 *
 *   like     anyone signed in, both types
 *   save     adverts (here) · items (the existing favorites toggle)
 *   comment  questions and reviews; the owner can reply once under each
 *   share    counted when someone shares the link
 *   view / contact / chat   recorded by the advert, item and chat services
 *
 * Every write goes to the source rows only; triggers keep the counters and the
 * activity log in step, and drop the owner's own actions from the analytics.
 */
import engagementRepository from '../repositories/engagement.repository.js';
import itemService from './item.service.js';
import { notify } from './notification.service.js';
import { BadRequest, NotFound, Forbidden } from '../lib/errors.js';
import { NOTIFICATION_TYPE } from '../config/constants.js';
import logger from '../lib/logger.js';

const STAFF = ['moderator', 'admin', 'super_admin'];
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

const linkFor = (type, id) => (type === 'advert' ? `/adverts/${id}` : `/items/${id}`);

const loadCounts = async (type, id) => {
  const counts = await engagementRepository.counts(type, id);
  if (!counts) throw NotFound(type === 'advert' ? 'Advertisement not found.' : 'Item not found.');
  return counts;
};

/* ───────────────────────── Reactions ───────────────────────── */

const toggle = async ({ type, id, userId, kind }) => {
  await loadCounts(type, id);

  // Item saves already have an endpoint and table; reuse them so a save made
  // from the new heart and one made from "Saved items" are the same thing.
  if (type === 'item' && kind === 'save') {
    const { favorited } = await itemService.toggleFavorite({ userId, itemId: id });
    const { ownerId, ...counts } = await loadCounts(type, id);
    return { active: favorited, counts };
  }

  const active = await engagementRepository.hasReaction(userId, type, id, kind);
  if (active) await engagementRepository.removeReaction(userId, type, id, kind);
  else await engagementRepository.addReaction(userId, type, id, kind);

  const { ownerId, ...counts } = await loadCounts(type, id);
  return { active: !active, counts };
};

export const toggleLike = ({ type, id, userId }) => toggle({ type, id, userId, kind: 'like' });
export const toggleSave = ({ type, id, userId }) => toggle({ type, id, userId, kind: 'save' });

/** Counts plus, when signed in, whether this viewer liked/saved it. */
export const stateFor = async ({ type, id, userId }) => {
  const { ownerId, ...counts } = await loadCounts(type, id);
  if (!userId) return { counts, liked: false, saved: false, isOwner: false };
  const { liked, saved } = await engagementRepository.viewerState(userId, type, [id]);
  return { counts, liked: liked.includes(id), saved: saved.includes(id), isOwner: ownerId === userId };
};

/** Batched for grids: one call fills every heart on the page. */
export const viewerState = ({ type, ids, userId }) => engagementRepository.viewerState(userId, type, ids);

export const share = async ({ type, id, userId }) => {
  await loadCounts(type, id);
  await engagementRepository.record(type, id, 'share', userId ?? null);
  return { shared: true };
};

/* ───────────────────────── Comments ───────────────────────── */

export const listComments = ({ type, id, page, limit }) => engagementRepository.listComments(type, id, { page, limit });

export const addComment = async ({ type, id, userId, userName, body, parentId }) => {
  const { ownerId } = await loadCounts(type, id);

  let parent = null;
  if (parentId) {
    parent = await engagementRepository.findComment(parentId);
    if (!parent || parent.entity_id !== id || parent.entity_type !== type) {
      throw BadRequest('That comment is no longer available.');
    }
    // One level of replies keeps threads readable on a phone.
    if (parent.parent_id) throw BadRequest('You can only reply to a top-level comment.');
  }

  const comment = await engagementRepository.createComment({
    entity_type: type,
    entity_id: id,
    user_id: userId,
    parent_id: parent?.id ?? null,
    body: body.trim(),
  });

  // Tell the owner about new comments, and the original author about replies.
  // Never notify someone about their own comment.
  const recipients = new Set();
  if (ownerId && ownerId !== userId) recipients.add(ownerId);
  if (parent && parent.user_id !== userId) recipients.add(parent.user_id);

  await Promise.allSettled(
    [...recipients].map((recipientId) =>
      notify({
        userId: recipientId,
        type: NOTIFICATION_TYPE.ITEM,
        title:
          recipientId === parent?.user_id
            ? `${userName ?? 'Someone'} replied to your comment`
            : `${userName ?? 'Someone'} commented on your ${type === 'advert' ? 'advert' : 'listing'}`,
        content: comment.body.slice(0, 140),
        actionUrl: `${linkFor(type, id)}#comments`,
        data: { entityType: type, entityId: id, commentId: comment.id },
      }),
    ),
  ).then((results) =>
    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => logger.warn('engagement.notify_failed', { error: result.reason?.message })),
  );

  return { ...comment, replies: [] };
};

/** Authors can delete their own; owners can delete anything on their post; staff anything. */
export const deleteComment = async ({ commentId, userId, role }) => {
  const comment = await engagementRepository.findComment(commentId);
  if (!comment) throw NotFound('Comment not found.');
  const { ownerId } = await loadCounts(comment.entity_type, comment.entity_id);

  const allowed = comment.user_id === userId || ownerId === userId || STAFF.includes(role);
  if (!allowed) throw Forbidden('You cannot remove this comment.');

  await engagementRepository.deleteComment(commentId);
  return { deleted: true };
};

/* ───────────────────────── Reports ───────────────────────── */

const KINDS = ['view', 'like', 'save', 'comment', 'share', 'contact', 'chat'];

const shapeSummary = (rows, people) => {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, { total: 0, people: 0 }]));
  for (const row of rows) totals[row.kind] = { total: Number(row.total), people: Number(row.people) };
  const interactions = KINDS.filter((kind) => kind !== 'view').reduce((sum, kind) => sum + totals[kind].total, 0);
  return { people: Number(people), interactions, totals };
};

/** Fills days with no activity, so the chart has no gaps. */
const shapeDaily = (rows, days) => {
  const byDay = new Map();
  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    const entry = byDay.get(key) ?? {};
    entry[row.kind] = Number(row.total);
    byDay.set(key, entry);
  }
  const out = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86_400_000);
    const key = date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
    const entry = byDay.get(key) ?? {};
    out.push({
      day: key,
      views: entry.view ?? 0,
      interactions: KINDS.filter((kind) => kind !== 'view').reduce((sum, kind) => sum + (entry[kind] ?? 0), 0),
    });
  }
  return out;
};

const shapeTop = (rows) =>
  rows.map((row) => ({
    id: row.entity_id,
    title: row.title,
    subtitle: row.subtitle,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    cover: row.cover,
    status: row.status,
    views: Number(row.views),
    likes: Number(row.likes),
    saves: Number(row.saves),
    comments: Number(row.comments),
    shares: Number(row.shares),
    contacts: Number(row.contacts),
    people: Number(row.people),
    score: Number(row.score),
  }));

/** Admin Engagement page, in one round trip. */
export const adminOverview = async ({ days }) => {
  const since = daysAgo(days);
  const previousSince = daysAgo(days * 2);

  const [rows, people, previousRows, previousPeople, daily, topAdverts, topItems, topOwners] = await Promise.all([
    engagementRepository.summary(since),
    engagementRepository.people(since),
    engagementRepository.summary(previousSince),
    engagementRepository.people(previousSince),
    engagementRepository.daily(days),
    engagementRepository.top('advert', since, 8),
    engagementRepository.top('item', since, 8),
    engagementRepository.topOwners(since, 8),
  ]);

  const current = shapeSummary(rows, people);
  // The previous window is (2×days ago → days ago): the wider window minus this one.
  const wide = shapeSummary(previousRows, previousPeople);
  const previous = {
    interactions: Math.max(wide.interactions - current.interactions, 0),
    views: Math.max(wide.totals.view.total - current.totals.view.total, 0),
  };

  return {
    days,
    summary: current,
    previous,
    daily: shapeDaily(daily, days),
    topAdverts: shapeTop(topAdverts),
    topItems: shapeTop(topItems),
    topOwners: topOwners.map((row) => ({
      id: row.owner_id,
      name: row.owner_name,
      avatarUrl: row.avatar_url,
      businessName: row.business_name,
      people: Number(row.people),
      interactions: Number(row.interactions),
      views: Number(row.views),
    })),
  };
};

/** The same picture, scoped to one vendor — for their own dashboard. */
export const ownerOverview = async ({ ownerId, days }) => {
  const since = daysAgo(days);
  const [rows, people, daily] = await Promise.all([
    engagementRepository.summary(since, ownerId),
    engagementRepository.people(since, ownerId),
    engagementRepository.daily(days, ownerId),
  ]);
  return { days, summary: shapeSummary(rows, people), daily: shapeDaily(daily, days) };
};

export const adminComments = async ({ page, limit, hidden }) => {
  const result = await engagementRepository.recentComments({ page, limit, hidden });
  const titles = await engagementRepository.titles(result.items);
  return {
    ...result,
    items: result.items.map((comment) => ({ ...comment, target: titles.get(comment.entity_id) ?? null })),
  };
};

export const adminSetCommentHidden = ({ commentId, hidden, actorId }) =>
  engagementRepository.setHidden(commentId, hidden, actorId);

export default {
  toggleLike,
  toggleSave,
  stateFor,
  viewerState,
  share,
  listComments,
  addComment,
  deleteComment,
  adminOverview,
  ownerOverview,
  adminComments,
  adminSetCommentHidden,
};
