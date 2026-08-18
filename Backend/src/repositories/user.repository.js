import { db, unwrap, range, compact } from './base.repository.js';

const PUBLIC_FIELDS =
  'id, full_name, avatar_url, country, state, city, is_verified, created_at';

const FULL_FIELDS = `
  id, full_name, avatar_url, phone, residential_address, date_of_birth, language, gender,
  country, state, city, zip_code, nationality, role, is_verified, is_suspended,
  suspension_reason, verification_submitted, profile_completed, last_seen_at,
  notification_preferences, created_at, updated_at
`;

export const userRepository = {
  async findById(id, { full = false } = {}) {
    return unwrap(
      await db.from('users').select(full ? FULL_FIELDS : PUBLIC_FIELDS).eq('id', id).maybeSingle(),
      'find user',
    );
  },

  async findByEmail(email) {
    // Emails live in auth.users, which PostgREST does not expose — use the admin API.
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw new Error(error.message);
    return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  },

  async upsertProfile(id, payload) {
    return unwrap(
      await db
        .from('users')
        .upsert({ id, ...compact(payload), updated_at: new Date().toISOString() })
        .select(FULL_FIELDS)
        .single(),
      'save profile',
    );
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('users')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(FULL_FIELDS)
        .single(),
      'update user',
    );
  },

  async touchLastSeen(id) {
    await db.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', id);
  },

  async list({ page, limit, search, status, country, role, sort = 'created_at', order = 'desc' }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('users').select(FULL_FIELDS, { count: 'exact' });

    if (search) query = query.or(`full_name.ilike.%${search}%,country.ilike.%${search}%`);
    if (country) query = query.eq('country', country);
    if (role) query = query.eq('role', role);
    if (status === 'verified') query = query.eq('is_verified', true);
    if (status === 'unverified') query = query.eq('is_verified', false);
    if (status === 'suspended') query = query.eq('is_suspended', true);
    if (status === 'pending_verification') query = query.eq('verification_submitted', true).eq('is_verified', false);

    const { data, count } = unwrap(
      await query.order(sort, { ascending: order === 'asc' }).range(from, to),
      'list users',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async countBy(column, value) {
    const { count } = unwrap(
      await db.from('users').select('id', { count: 'exact', head: true }).eq(column, value),
      'count users',
    );
    return count ?? 0;
  },

  async countAll() {
    const { count } = unwrap(
      await db.from('users').select('id', { count: 'exact', head: true }),
      'count users',
    );
    return count ?? 0;
  },

  async countCreatedSince(isoDate) {
    const { count } = unwrap(
      await db.from('users').select('id', { count: 'exact', head: true }).gte('created_at', isoDate),
      'count new users',
    );
    return count ?? 0;
  },

  async groupByCountry() {
    const data = unwrap(await db.from('users').select('country'), 'group users by country');
    const tally = new Map();
    for (const row of data ?? []) {
      const key = row.country || 'Unknown';
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  },

  async deleteAuthUser(id) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
  },
};

export default userRepository;
