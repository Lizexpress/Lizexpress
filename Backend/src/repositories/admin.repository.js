import { db, unwrap, range, compact } from './base.repository.js';

/** Append-only audit trail. Every privileged mutation writes one row. */
export const auditRepository = {
  async record({ actorId, action, entityType, entityId, before, after, ipAddress, userAgent }) {
    const { error } = await db.from('admin_actions').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before_state: before ?? null,
      after_state: after ?? null,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    });
    // Auditing must never break the operation it is recording.
    if (error) console.error(JSON.stringify({ level: 'error', message: 'audit.failed', error: error.message }));
  },

  async list({ page, limit, actorId, action, entityType }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db
      .from('admin_actions')
      .select('*, actor:users!admin_actions_actor_id_fkey(id, full_name, avatar_url, role)', { count: 'exact' });

    if (actorId) query = query.eq('actor_id', actorId);
    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list audit log',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },
};

export const taskRepository = {
  async create(payload) {
    return unwrap(await db.from('admin_tasks').insert(compact(payload)).select('*').single(), 'create task');
  },

  async list({ page, limit, status, priority, assigneeId }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db
      .from('admin_tasks')
      .select('*, assignee:users!admin_tasks_assignee_id_fkey(id, full_name, avatar_url)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigneeId) query = query.eq('assignee_id', assigneeId);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list tasks',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('admin_tasks')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single(),
      'update task',
    );
  },

  async remove(id) {
    unwrap(await db.from('admin_tasks').delete().eq('id', id), 'delete task');
  },
};

export const settingsRepository = {
  async all() {
    const rows = unwrap(await db.from('platform_settings').select('key, value, updated_at'), 'read settings') ?? [];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },

  async get(key, fallback = null) {
    const row = unwrap(
      await db.from('platform_settings').select('value').eq('key', key).maybeSingle(),
      'read setting',
    );
    return row?.value ?? fallback;
  },

  async set(key, value, actorId) {
    return unwrap(
      await db
        .from('platform_settings')
        .upsert(
          { key, value, updated_by: actorId ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
        .select('key, value, updated_at')
        .single(),
      'save setting',
    );
  },
};

export const feedbackRepository = {
  async create(payload) {
    return unwrap(await db.from('feedback').insert(compact(payload)).select('*').single(), 'create feedback');
  },

  async list({ page, limit, status, type }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db
      .from('feedback')
      .select('*, user:users!feedback_user_id_fkey(id, full_name, avatar_url)', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list feedback',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async update(id, payload) {
    return unwrap(await db.from('feedback').update(compact(payload)).eq('id', id).select('*').single(), 'update feedback');
  },

  /** Public testimonials — approved, high-rated feedback only. */
  async testimonials(limit = 12) {
    return unwrap(
      await db
        .from('feedback')
        .select('id, rating, message, created_at, user:users!feedback_user_id_fkey(id, full_name, avatar_url, country, city)')
        .eq('is_testimonial', true)
        .eq('status', 'approved')
        .gte('rating', 4)
        .order('created_at', { ascending: false })
        .limit(limit),
      'list testimonials',
    );
  },
};

export const favoriteRepository = {
  async toggle(userId, itemId) {
    const existing = unwrap(
      await db.from('favorites').select('id').eq('user_id', userId).eq('item_id', itemId).maybeSingle(),
      'find favorite',
    );
    if (existing) {
      unwrap(await db.from('favorites').delete().eq('id', existing.id), 'remove favorite');
      return { favorited: false };
    }
    unwrap(await db.from('favorites').insert({ user_id: userId, item_id: itemId }), 'add favorite');
    return { favorited: true };
  },

  async listForUser(userId, { page, limit }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    const { data, count } = unwrap(
      await db
        .from('favorites')
        .select('id, created_at, item:items(id, name, images, estimated_cost, category, condition, status, city, state)', {
          count: 'exact',
        })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to),
      'list favorites',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /** Count only — head:true skips transferring any rows. */
  async countForUser(userId) {
    const { count } = unwrap(
      await db.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      'count favorites',
    );
    return count ?? 0;
  },
};

export default { auditRepository, taskRepository, settingsRepository, feedbackRepository, favoriteRepository };
