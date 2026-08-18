/**
 * Admin console.
 *
 * v1's admin panel authenticated against a hardcoded email/password pair that
 * was published in the README, and several "real-time" figures were simulated
 * in the browser. v2 uses the same Supabase identity as everyone else, gated by
 * a `role` column that only service-role can write, and every number below is a
 * real aggregate query.
 */
import userRepository from '../repositories/user.repository.js';
import itemRepository from '../repositories/item.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import verificationRepository from '../repositories/verification.repository.js';
import { messageRepository } from '../repositories/chat.repository.js';
import {
  auditRepository,
  taskRepository,
  settingsRepository,
  feedbackRepository,
} from '../repositories/admin.repository.js';
import { notify } from './notification.service.js';
import { sendTemplate } from './email.service.js';
import realtime from './realtime.service.js';
import { adminClient } from '../lib/supabase.js';
import { NotFound, BadRequest, Forbidden } from '../lib/errors.js';
import { ITEM_STATUS, PAYMENT_STATUS, VERIFICATION_STATUS, USER_ROLE, NOTIFICATION_TYPE } from '../config/constants.js';
import logger from '../lib/logger.js';

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

/* ───────────────── Dashboard ───────────────── */

export const overview = async () => {
  const [
    totalUsers,
    verifiedUsers,
    suspendedUsers,
    newUsers7d,
    newUsers30d,
    totalItems,
    activeItems,
    swappedItems,
    pendingPaymentItems,
    verificationCounts,
    revenueAll,
    revenue30d,
  ] = await Promise.all([
    userRepository.countAll(),
    userRepository.countBy('is_verified', true),
    userRepository.countBy('is_suspended', true),
    userRepository.countCreatedSince(daysAgo(7)),
    userRepository.countCreatedSince(daysAgo(30)),
    itemRepository.countBy({}),
    itemRepository.countBy({ status: ITEM_STATUS.ACTIVE }),
    itemRepository.countBy({ status: ITEM_STATUS.SWAPPED }),
    itemRepository.countBy({ status: ITEM_STATUS.PENDING_PAYMENT }),
    verificationRepository.counts(),
    paymentRepository.revenueSummary(),
    paymentRepository.revenueSummary({ since: daysAgo(30) }),
  ]);

  const oldest = await verificationRepository.oldestPending();

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      unverified: totalUsers - verifiedUsers,
      suspended: suspendedUsers,
      newLast7Days: newUsers7d,
      newLast30Days: newUsers30d,
      verificationRate: totalUsers ? Number(((verifiedUsers / totalUsers) * 100).toFixed(1)) : 0,
    },
    items: {
      total: totalItems,
      active: activeItems,
      swapped: swappedItems,
      awaitingPayment: pendingPaymentItems,
    },
    verifications: {
      ...verificationCounts,
      oldestWaitingHours: oldest
        ? Math.floor((Date.now() - new Date(oldest.submitted_at).getTime()) / 3_600_000)
        : 0,
    },
    revenue: {
      allTime: revenueAll.total,
      last30Days: revenue30d.total,
      transactions: revenueAll.count,
      averageTicket: revenueAll.count ? Math.round(revenueAll.total / revenueAll.count) : 0,
    },
  };
};

/** Daily buckets for the dashboard chart — computed, not faked. */
export const timeseries = async ({ days = 30 }) => {
  const since = daysAgo(days);
  const { rows } = await paymentRepository.revenueSummary({ since });

  const buckets = new Map();
  for (let index = days - 1; index >= 0; index -= 1) {
    buckets.set(new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10), { revenue: 0, transactions: 0 });
  }
  for (const row of rows) {
    const key = String(row.created_at).slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += Number(row.amount || 0);
      bucket.transactions += 1;
    }
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
};

export const analytics = async () => {
  const [byCountry, revenueByCountry, categories] = await Promise.all([
    userRepository.groupByCountry(),
    paymentRepository.revenueByCountry(),
    itemRepository.categoryBreakdown(),
  ]);

  const revenueMap = new Map(revenueByCountry.map((row) => [row.country, row]));
  const countries = byCountry.map((row) => ({
    country: row.country,
    users: row.count,
    revenue: revenueMap.get(row.country)?.revenue ?? 0,
    transactions: revenueMap.get(row.country)?.transactions ?? 0,
  }));

  return { countries, categories };
};

/* ───────────────── User management ───────────────── */

export const listUsers = (filters) => userRepository.list(filters);

export const userDetail = async (id) => {
  const user = await userRepository.findById(id, { full: true });
  if (!user) throw NotFound('User not found.');

  const [items, payments, verification, unreadMessages, authUser] = await Promise.all([
    itemRepository.search({ userId: id, page: 1, limit: 10 }),
    paymentRepository.list({ userId: id, page: 1, limit: 10 }),
    verificationRepository.findLatestForUser(id),
    messageRepository.unreadCount(id),
    adminClient.auth.admin.getUserById(id),
  ]);

  return {
    ...user,
    email: authUser?.data?.user?.email ?? null,
    emailConfirmedAt: authUser?.data?.user?.email_confirmed_at ?? null,
    lastSignInAt: authUser?.data?.user?.last_sign_in_at ?? null,
    listings: items,
    payments: payments.items,
    verification: verification
      ? { id: verification.id, status: verification.status, submittedAt: verification.submitted_at }
      : null,
    unreadMessages,
  };
};

export const setSuspension = async ({ id, actorId, suspended, reason, request }) => {
  const user = await userRepository.findById(id, { full: true });
  if (!user) throw NotFound('User not found.');
  if (suspended && !reason) throw BadRequest('A reason is required when suspending an account.');

  const updated = await userRepository.update(id, {
    is_suspended: suspended,
    suspension_reason: suspended ? reason : null,
  });

  const { data: authUser } = await adminClient.auth.admin.getUserById(id);

  await notify({
    userId: id,
    type: NOTIFICATION_TYPE.SYSTEM,
    title: suspended ? 'Your account has been suspended' : 'Your account has been reinstated',
    content: suspended ? reason : 'You can use LizExpress normally again.',
    email:
      suspended && authUser?.user?.email
        ? { template: 'accountSuspended', to: authUser.user.email, props: { name: user.full_name, reason } }
        : undefined,
  });

  await auditRepository.record({
    actorId,
    action: suspended ? 'user.suspended' : 'user.reinstated',
    entityType: 'user',
    entityId: id,
    before: { is_suspended: user.is_suspended },
    after: { is_suspended: suspended, reason: reason ?? null },
    ipAddress: request?.ip,
  });

  return updated;
};

export const setRole = async ({ id, actorId, actorRole, role, request }) => {
  if (!Object.values(USER_ROLE).includes(role)) throw BadRequest('Unknown role.');
  // Only a super admin can mint another super admin.
  if (role === USER_ROLE.SUPER_ADMIN && actorRole !== USER_ROLE.SUPER_ADMIN) {
    throw Forbidden('Only a super admin can grant super admin access.');
  }
  if (id === actorId) throw BadRequest('You cannot change your own role.');

  const user = await userRepository.findById(id, { full: true });
  if (!user) throw NotFound('User not found.');

  const updated = await userRepository.update(id, { role });

  await auditRepository.record({
    actorId,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: id,
    before: { role: user.role },
    after: { role },
    ipAddress: request?.ip,
  });

  logger.info('admin.role_changed', { targetId: id, role, actorId });
  return updated;
};

export const inviteAdmin = async ({ email, fullName, role, actorId, actorName }) => {
  if (![USER_ROLE.MODERATOR, USER_ROLE.ADMIN].includes(role)) {
    throw BadRequest('Invite role must be moderator or admin.');
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, invited_role: role },
  });
  if (error) throw BadRequest(error.message);

  await userRepository.upsertProfile(data.user.id, { full_name: fullName, role });
  await sendTemplate('adminInvite', email, {
    name: fullName,
    role,
    invitedBy: actorName,
    inviteUrl: `${process.env.ADMIN_URL ?? ''}/accept-invite`,
  });

  await auditRepository.record({
    actorId,
    action: 'admin.invited',
    entityType: 'user',
    entityId: data.user.id,
    after: { email, role },
  });

  return { invited: true, userId: data.user.id };
};

export const deleteUser = async ({ id, actorId, request }) => {
  const user = await userRepository.findById(id, { full: true });
  if (!user) throw NotFound('User not found.');
  if (user.role !== USER_ROLE.USER) throw Forbidden('Demote this account before deleting it.');

  await auditRepository.record({
    actorId,
    action: 'user.deleted',
    entityType: 'user',
    entityId: id,
    before: user,
    ipAddress: request?.ip,
  });

  // ON DELETE CASCADE on public.users clears the rest.
  await userRepository.deleteAuthUser(id);
  return { deleted: true };
};

/* ───────────────── Moderation ───────────────── */

export const listItems = (filters) =>
  itemRepository.search({ ...filters, userId: filters.userId ?? undefined });

export const setItemStatus = async ({ id, actorId, status, reason, request }) => {
  const item = await itemRepository.findById(id);
  if (!item) throw NotFound('Item not found.');

  const updated = await itemRepository.update(id, { status });

  if (status === ITEM_STATUS.SUSPENDED) {
    await notify({
      userId: item.user_id,
      type: NOTIFICATION_TYPE.ITEM,
      title: 'Your listing was removed',
      content: reason ?? 'This listing did not meet our marketplace guidelines.',
      actionUrl: '/dashboard/listings',
    });
  }

  await auditRepository.record({
    actorId,
    action: 'item.status_changed',
    entityType: 'item',
    entityId: id,
    before: { status: item.status },
    after: { status, reason: reason ?? null },
    ipAddress: request?.ip,
  });

  return updated;
};

export const listPayments = (filters) => paymentRepository.list(filters);
export const recentMessages = (limit) => messageRepository.recent(limit);

/* ───────────────── Tasks, settings, feedback, audit ───────────────── */

export const createTask = async ({ actorId, payload }) => {
  const task = await taskRepository.create({
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    status: 'pending',
    due_date: payload.dueDate,
    assignee_id: payload.assigneeId,
    created_by: actorId,
  });
  await realtime.adminEvent('task:created', task);
  return task;
};

export const listTasks = (filters) => taskRepository.list(filters);
export const updateTask = ({ id, payload }) => taskRepository.update(id, payload);
export const deleteTask = ({ id }) => taskRepository.remove(id);

export const settings = () => settingsRepository.all();
export const updateSetting = async ({ key, value, actorId }) => {
  const result = await settingsRepository.set(key, value, actorId);
  await auditRepository.record({ actorId, action: 'settings.updated', entityType: 'setting', entityId: key, after: { value } });
  return result;
};

export const listFeedback = (filters) => feedbackRepository.list(filters);
export const updateFeedback = ({ id, payload }) => feedbackRepository.update(id, payload);
export const auditLog = (filters) => auditRepository.list(filters);

/** Health strip for the dashboard — real checks, not a green square. */
export const systemHealth = async () => {
  const started = Date.now();
  let database = 'operational';
  try {
    await userRepository.countAll();
  } catch {
    database = 'degraded';
  }

  const pending = await verificationRepository.counts();
  return {
    database,
    databaseLatencyMs: Date.now() - started,
    email: process.env.RESEND_API_KEY ? 'configured' : 'not_configured',
    payments: process.env.FLUTTERWAVE_SECRET_KEY ? 'configured' : 'not_configured',
    push: process.env.VAPID_PUBLIC_KEY ? 'configured' : 'not_configured',
    queues: { verificationsPending: pending[VERIFICATION_STATUS.PENDING] ?? 0 },
    checkedAt: new Date().toISOString(),
  };
};

export default {
  overview,
  timeseries,
  analytics,
  listUsers,
  userDetail,
  setSuspension,
  setRole,
  inviteAdmin,
  deleteUser,
  listItems,
  setItemStatus,
  listPayments,
  recentMessages,
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  settings,
  updateSetting,
  listFeedback,
  updateFeedback,
  auditLog,
  systemHealth,
};
