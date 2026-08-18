import { db, unwrap, range, compact } from './base.repository.js';
import { VERIFICATION_STATUS } from '../config/constants.js';

const FIELDS = `
  id, user_id, reference, document_type, document_number, identity_document,
  identity_document_back, address_document, selfie_image, status, submitted_at,
  reviewed_at, reviewed_by, rejection_reason, reviewer_notes, attempt_count,
  created_at, updated_at,
  user:users!verifications_user_id_fkey(
    id, full_name, avatar_url, phone, date_of_birth, nationality,
    country, state, city, residential_address, is_verified, created_at
  ),
  reviewer:users!verifications_reviewed_by_fkey(id, full_name)
`;

export const verificationRepository = {
  async create(payload) {
    return unwrap(await db.from('verifications').insert(compact(payload)).select(FIELDS).single(), 'submit verification');
  },

  async findById(id) {
    return unwrap(await db.from('verifications').select(FIELDS).eq('id', id).maybeSingle(), 'find verification');
  },

  async findLatestForUser(userId) {
    return unwrap(
      await db
        .from('verifications')
        .select(FIELDS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'find user verification',
    );
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('verifications')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(FIELDS)
        .single(),
      'update verification',
    );
  },

  /** The admin review queue. Defaults to oldest-first so nobody waits indefinitely. */
  async list({ page, limit, status, search, sort = 'submitted_at', order = 'asc' }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('verifications').select(FIELDS, { count: 'exact' });

    if (status && status !== 'all') query = query.eq('status', status);
    if (search) query = query.or(`reference.ilike.%${search}%,document_number.ilike.%${search}%`);

    const { data, count } = unwrap(
      await query.order(sort, { ascending: order === 'asc' }).range(from, to),
      'list verifications',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async counts() {
    const statuses = Object.values(VERIFICATION_STATUS);
    const entries = await Promise.all(
      statuses.map(async (status) => {
        const { count } = unwrap(
          await db.from('verifications').select('id', { count: 'exact', head: true }).eq('status', status),
          'count verifications',
        );
        return [status, count ?? 0];
      }),
    );
    return Object.fromEntries(entries);
  },

  async oldestPending() {
    return unwrap(
      await db
        .from('verifications')
        .select('submitted_at')
        .in('status', [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.UNDER_REVIEW])
        .order('submitted_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      'oldest pending verification',
    );
  },
};

export default verificationRepository;
