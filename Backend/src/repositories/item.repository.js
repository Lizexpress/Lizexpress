import { db, unwrap, range, compact } from './base.repository.js';
import { ITEM_STATUS } from '../config/constants.js';

const OWNER = 'owner:users!items_user_id_fkey(id, full_name, avatar_url, is_verified, country, state, city)';
const LIST_FIELDS = `
  id, user_id, name, description, category, subcategory, condition, buying_price,
  estimated_cost, swap_for, location, country, state, city, images, status,
  payment_status, view_count, favorite_count, is_featured, published_at, created_at, updated_at,
  ${OWNER}
`;

export const itemRepository = {
  async create(payload) {
    return unwrap(
      await db.from('items').insert(compact(payload)).select(LIST_FIELDS).single(),
      'create item',
    );
  },

  async findById(id) {
    return unwrap(await db.from('items').select(LIST_FIELDS).eq('id', id).maybeSingle(), 'find item');
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('items')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(LIST_FIELDS)
        .single(),
      'update item',
    );
  },

  async remove(id) {
    unwrap(await db.from('items').delete().eq('id', id), 'delete item');
  },

  /**
   * Public browse. Only published items are ever returned here —
   * drafts and unpaid listings are invisible regardless of query parameters.
   */
  async search({ page, limit, q, category, condition, country, state, city, minValue, maxValue, sort = 'newest', userId, status }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('items').select(LIST_FIELDS, { count: 'exact' });

    if (userId) {
      query = query.eq('user_id', userId);
      if (status) query = query.eq('status', status);
    } else {
      query = query.eq('status', ITEM_STATUS.ACTIVE).eq('payment_status', 'paid');
    }

    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,swap_for.ilike.%${q}%`);
    if (category) query = query.eq('category', category);
    if (condition) query = query.eq('condition', condition);
    if (country) query = query.eq('country', country);
    if (state) query = query.eq('state', state);
    if (city) query = query.eq('city', city);
    if (minValue != null) query = query.gte('estimated_cost', minValue);
    if (maxValue != null) query = query.lte('estimated_cost', maxValue);

    const ordering = {
      newest: ['published_at', false],
      oldest: ['published_at', true],
      price_low: ['estimated_cost', true],
      price_high: ['estimated_cost', false],
      popular: ['view_count', false],
    }[sort] ?? ['published_at', false];

    const { data, count } = unwrap(
      await query
        .order(ordering[0], { ascending: ordering[1], nullsFirst: false })
        .range(from, to),
      'search items',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /** Atomic counter — avoids the read-modify-write race two viewers would otherwise hit. */
  async incrementViews(id) {
    await db.rpc('increment_item_views', { item_id: id });
  },

  async countBy(filters = {}) {
    let query = db.from('items').select('id', { count: 'exact', head: true });
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    const { count } = unwrap(await query, 'count items');
    return count ?? 0;
  },

  async categoryBreakdown() {
    const data = unwrap(
      await db.from('items').select('category').eq('status', ITEM_STATUS.ACTIVE),
      'category breakdown',
    );
    const tally = new Map();
    for (const row of data ?? []) tally.set(row.category, (tally.get(row.category) ?? 0) + 1);
    return [...tally.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  },
};

export default itemRepository;
