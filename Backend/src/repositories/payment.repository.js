import { db, unwrap, range, compact } from './base.repository.js';
import { PAYMENT_STATUS } from '../config/constants.js';

/**
 * Plain columns only — no embedded joins.
 *
 * The old payments table links user_id to Supabase's internal login table, not
 * to public.users, so an embed like users!payments_user_id_fkey fails with
 * PGRST200 and takes the whole request (including the insert) down with it.
 * Related rows are loaded separately in attach(), which works whatever the
 * table's links look like.
 */
const FIELDS = '*';

const byId = (rows) => new Map((rows ?? []).map((row) => [row.id, row]));
const ids = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];

const attach = async (input) => {
  const rows = (Array.isArray(input) ? input : [input]).filter(Boolean);
  if (!rows.length) return input;

  const [users, items, adverts] = await Promise.all([
    ids(rows, 'user_id').length
      ? db.from('users').select('id, full_name, country').in('id', ids(rows, 'user_id')).then((res) => res.data)
      : [],
    ids(rows, 'item_id').length
      ? db.from('items').select('id, name, estimated_cost').in('id', ids(rows, 'item_id')).then((res) => res.data)
      : [],
    ids(rows, 'advert_id').length
      ? db.from('adverts').select('id, title, business_name').in('id', ids(rows, 'advert_id')).then((res) => res.data)
      : [],
  ]);
  const userMap = byId(users);
  const itemMap = byId(items);
  const advertMap = byId(adverts);

  const out = rows.map((row) => ({
    ...row,
    user: userMap.get(row.user_id) ?? null,
    item: itemMap.get(row.item_id) ?? null,
    advert: advertMap.get(row.advert_id) ?? null,
  }));
  return Array.isArray(input) ? out : out[0];
};

export const paymentRepository = {
  async create(payload) {
    return attach(unwrap(await db.from('payments').insert(compact(payload)).select(FIELDS).single(), 'create payment'));
  },

  async findByTxRef(txRef) {
    return attach(unwrap(await db.from('payments').select(FIELDS).eq('tx_ref', txRef).maybeSingle(), 'find payment'));
  },

  async findById(id) {
    return attach(unwrap(await db.from('payments').select(FIELDS).eq('id', id).maybeSingle(), 'find payment'));
  },

  async update(id, payload) {
    return attach(
      unwrap(
        await db
          .from('payments')
          .update({ ...compact(payload), updated_at: new Date().toISOString() })
          .eq('id', id)
          .select(FIELDS)
          .single(),
        'update payment',
      ),
    );
  },

  async list({ page, limit, status, userId, from: fromDate, to: toDate }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('payments').select(FIELDS, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (userId) query = query.eq('user_id', userId);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list payments',
    );
    return { items: await attach(data ?? []), total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /** Successful advert payments, optionally for one advert. Plain rows, no joins. */
  async successfulForAdverts(advertId) {
    let query = db
      .from('payments')
      .select('id, advert_id, amount, currency, paid_at, created_at, payment_method, tx_ref, photo_count, user_id, purpose')
      .eq('status', PAYMENT_STATUS.SUCCESSFUL)
      .not('advert_id', 'is', null);
    if (advertId) query = query.eq('advert_id', advertId);
    return unwrap(await query.order('created_at', { ascending: true }).limit(1000), 'list advert payments') ?? [];
  },

  async revenueSummary({ since } = {}) {
    let query = db.from('payments').select('amount, currency, created_at, user_id').eq('status', PAYMENT_STATUS.SUCCESSFUL);
    if (since) query = query.gte('paid_at', since);
    const rows = unwrap(await query, 'revenue summary') ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { total, count: rows.length, rows };
  },

  async revenueByCountry() {
    const rows = await attach(
      unwrap(
        await db.from('payments').select('amount, user_id').eq('status', PAYMENT_STATUS.SUCCESSFUL),
        'revenue by country',
      ) ?? [],
    );

    const tally = new Map();
    for (const row of rows) {
      const country = row.user?.country || 'Unknown';
      const current = tally.get(country) ?? { country, revenue: 0, transactions: 0 };
      current.revenue += Number(row.amount || 0);
      current.transactions += 1;
      tally.set(country, current);
    }
    return [...tally.values()].sort((a, b) => b.revenue - a.revenue);
  },
};

export default paymentRepository;
