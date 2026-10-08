import { db, unwrap, range, compact } from './base.repository.js';
import { PAYMENT_STATUS } from '../config/constants.js';

const FIELDS = `
  id, user_id, item_id, tx_ref, amount, currency, status, flutterwave_transaction_id,
  flutterwave_reference, payment_method, fee_percentage, item_value, failure_reason,
  paid_at, created_at, updated_at, purpose, advert_id, photo_count,
  user:users!payments_user_id_fkey(id, full_name, country),
  item:items(id, name, estimated_cost)
`;

export const paymentRepository = {
  async create(payload) {
    return unwrap(await db.from('payments').insert(compact(payload)).select(FIELDS).single(), 'create payment');
  },

  async findByTxRef(txRef) {
    return unwrap(await db.from('payments').select(FIELDS).eq('tx_ref', txRef).maybeSingle(), 'find payment');
  },

  async findById(id) {
    return unwrap(await db.from('payments').select(FIELDS).eq('id', id).maybeSingle(), 'find payment');
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('payments')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(FIELDS)
        .single(),
      'update payment',
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
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async revenueSummary({ since } = {}) {
    let query = db.from('payments').select('amount, currency, created_at, user_id').eq('status', PAYMENT_STATUS.SUCCESSFUL);
    if (since) query = query.gte('paid_at', since);
    const rows = unwrap(await query, 'revenue summary') ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { total, count: rows.length, rows };
  },

  async revenueByCountry() {
    const rows =
      unwrap(
        await db
          .from('payments')
          .select('amount, user:users!payments_user_id_fkey(country)')
          .eq('status', PAYMENT_STATUS.SUCCESSFUL),
        'revenue by country',
      ) ?? [];

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
