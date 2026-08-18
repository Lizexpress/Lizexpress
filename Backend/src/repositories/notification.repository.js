import { db, unwrap, range } from './base.repository.js';

const FIELDS = 'id, user_id, type, title, content, data, action_url, is_read, read_at, created_at';

export const notificationRepository = {
  async create(payload) {
    return unwrap(await db.from('notifications').insert(payload).select(FIELDS).single(), 'create notification');
  },

  async createMany(payloads) {
    if (!payloads.length) return [];
    return unwrap(await db.from('notifications').insert(payloads).select(FIELDS), 'create notifications');
  },

  async listForUser(userId, { page, limit, unreadOnly }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('notifications').select(FIELDS, { count: 'exact' }).eq('user_id', userId);
    if (unreadOnly) query = query.eq('is_read', false);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list notifications',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async unreadCount(userId) {
    const { count } = unwrap(
      await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false),
      'unread notifications',
    );
    return count ?? 0;
  },

  async markRead(id, userId) {
    return unwrap(
      await db
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select(FIELDS)
        .single(),
      'mark notification read',
    );
  },

  async markAllRead(userId) {
    await db
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  async remove(id, userId) {
    unwrap(await db.from('notifications').delete().eq('id', id).eq('user_id', userId), 'delete notification');
  },
};

export const pushRepository = {
  async saveSubscription({ userId, endpoint, keys, platform, deviceId, userAgent }) {
    return unwrap(
      await db
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh: keys?.p256dh ?? null,
            auth: keys?.auth ?? null,
            platform: platform ?? 'web',
            device_id: deviceId ?? null,
            user_agent: userAgent ?? null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' },
        )
        .select('id, endpoint, platform, created_at')
        .single(),
      'save push subscription',
    );
  },

  async listForUser(userId) {
    return unwrap(
      await db.from('push_subscriptions').select('*').eq('user_id', userId).eq('is_active', true),
      'list push subscriptions',
    );
  },

  async deactivate(endpoint) {
    await db.from('push_subscriptions').update({ is_active: false }).eq('endpoint', endpoint);
  },

  async remove(endpoint, userId) {
    unwrap(
      await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId),
      'delete push subscription',
    );
  },
};

export default { notificationRepository, pushRepository };
