import { db, unwrap, range, compact } from './base.repository.js';

/**
 * Adverts are read far more often than written, and almost always filtered by
 * location. Every query below leads with state / LGA / city so it lands on the
 * indexes installed by migration 001 rather than a sequential scan.
 */

const LIST_FIELDS = `
  id, user_id, business_name, title, category, subcategory,
  price_from, price_to, price_note,
  country, state, state_code, lga, city,
  status, photo_count, published_at, expires_at, view_count, created_at,
  like_count, save_count, comment_count, share_count, contact_count,
  photos:advert_photos ( id, url, storage_path, caption, position )
`;

const DETAIL_FIELDS = `
  id, user_id, business_name, title, description, category, subcategory,
  price_from, price_to, price_note,
  contact_phone, contact_whatsapp, contact_email, website_url,
  country, state, state_code, lga, city, address,
  status, photo_count, amount_due_kobo, amount_paid_kobo,
  published_at, expires_at, view_count, contact_count,
  like_count, save_count, comment_count, share_count,
  suspended_reason, created_at, updated_at,
  owner:users!adverts_user_id_fkey ( id, full_name, avatar_url, is_verified ),
  photos:advert_photos ( id, url, storage_path, caption, position, is_paid )
`;

export const advertRepository = {
  async create(payload) {
    return unwrap(
      await db.from('adverts').insert(compact(payload)).select(DETAIL_FIELDS).single(),
      'create advert',
    );
  },

  async findById(id) {
    return unwrap(
      await db.from('adverts').select(DETAIL_FIELDS).eq('id', id).maybeSingle(),
      'find advert',
    );
  },

  async update(id, payload) {
    return unwrap(
      await db
        .from('adverts')
        .update({ ...compact(payload), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(DETAIL_FIELDS)
        .single(),
      'update advert',
    );
  },

  async remove(id) {
    unwrap(await db.from('adverts').delete().eq('id', id), 'delete advert');
    return { deleted: true };
  },

  /**
   * Public search.
   *
   * Location is applied as an AND chain, so state → LGA → city narrows rather
   * than widens. Text search runs against the maintained tsvector; the trigram
   * indexes are the fallback for partial place names ("Ikej" → Ikeja).
   */
  async search({ page, limit, q, category, state, stateCode, lga, city, minPrice, maxPrice, sort = 'newest' }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });

    let query = db
      .from('adverts')
      .select(LIST_FIELDS, { count: 'exact' })
      .eq('status', 'active');

    if (stateCode) query = query.eq('state_code', stateCode);
    else if (state) query = query.ilike('state', state);

    if (lga) query = query.ilike('lga', `%${lga}%`);
    if (city) query = query.ilike('city', `%${city}%`);
    if (category) query = query.eq('category', category);

    if (minPrice !== undefined) query = query.gte('price_from', minPrice);
    if (maxPrice !== undefined) query = query.lte('price_from', maxPrice);

    if (q) {
      // websearch_to_tsquery tolerates the way people actually type into a
      // search box — quoted phrases, stray operators — without throwing.
      query = query.textSearch('search_vector', q, { type: 'websearch', config: 'simple' });
    }

    const ordering = {
      newest: ['published_at', false],
      oldest: ['published_at', true],
      popular: ['view_count', false],
      price_low: ['price_from', true],
      price_high: ['price_from', false],
    }[sort] ?? ['published_at', false];

    const { data, count } = unwrap(
      await query.order(ordering[0], { ascending: ordering[1], nullsFirst: false }).range(from, to),
      'search adverts',
    );

    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async listForUser({ userId, page, limit, status }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('adverts').select(LIST_FIELDS, { count: 'exact' }).eq('user_id', userId);
    if (status) query = query.eq('status', status);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list user adverts',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /** Admin queue — unlike the public search this sees every status. */
  async listForAdmin({ page, limit, status, state, search }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    let query = db.from('adverts').select(LIST_FIELDS, { count: 'exact' });

    if (status && status !== 'all') query = query.eq('status', status);
    if (state) query = query.ilike('state', state);
    if (search) query = query.or(`business_name.ilike.%${search}%,title.ilike.%${search}%`);

    const { data, count } = unwrap(
      await query.order('created_at', { ascending: false }).range(from, to),
      'list adverts for admin',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  /* ── Photos ── */

  async addPhoto(payload) {
    return unwrap(
      await db.from('advert_photos').insert(compact(payload)).select('*').single(),
      'add advert photo',
    );
  },

  async findPhoto(photoId) {
    return unwrap(
      await db.from('advert_photos').select('*, advert:adverts(id, user_id, status)').eq('id', photoId).maybeSingle(),
      'find advert photo',
    );
  },

  async removePhoto(photoId) {
    unwrap(await db.from('advert_photos').delete().eq('id', photoId), 'delete advert photo');
    return { deleted: true };
  },

  async unpaidPhotos(advertId) {
    return unwrap(
      await db.from('advert_photos').select('id, price_kobo').eq('advert_id', advertId).eq('is_paid', false),
      'list unpaid photos',
    );
  },

  async markPhotosPaid(advertId, paymentId) {
    unwrap(
      await db
        .from('advert_photos')
        .update({ is_paid: true, payment_id: paymentId })
        .eq('advert_id', advertId)
        .eq('is_paid', false),
      'mark photos paid',
    );
  },

  /* ── Counters & stats ── */

  async incrementViews(id) {
    await db.rpc('increment_advert_views', { p_advert_id: id });
  },

  async incrementContacts(id) {
    await db.rpc('increment_advert_contacts', { p_advert_id: id });
  },

  async expireLapsed() {
    const { data } = await db.rpc('expire_lapsed_adverts');
    return data ?? 0;
  },

  async countBy(column, value) {
    const { count } = unwrap(
      await db.from('adverts').select('id', { count: 'exact', head: true }).eq(column, value),
      'count adverts',
    );
    return count ?? 0;
  },

  /** Advertiser dashboard figures in one round trip. */
  async statsForUser(userId) {
    const rows = unwrap(
      await db.from('adverts').select('status, view_count, contact_count, like_count, save_count, comment_count').eq('user_id', userId),
      'advert stats for user',
    ) ?? [];
    return {
      totalAdverts: rows.length,
      activeAdverts: rows.filter((row) => row.status === 'active').length,
      draftAdverts: rows.filter((row) => ['draft', 'pending_payment'].includes(row.status)).length,
      advertViews: rows.reduce((sum, row) => sum + (row.view_count ?? 0), 0),
      advertContacts: rows.reduce((sum, row) => sum + (row.contact_count ?? 0), 0),
      advertLikes: rows.reduce((sum, row) => sum + (row.like_count ?? 0), 0),
      advertSaves: rows.reduce((sum, row) => sum + (row.save_count ?? 0), 0),
      advertComments: rows.reduce((sum, row) => sum + (row.comment_count ?? 0), 0),
    };
  },

  async countAll() {
    const { count } = unwrap(
      await db.from('adverts').select('id', { count: 'exact', head: true }),
      'count adverts',
    );
    return count ?? 0;
  },

  /** Powers the location filter chips — only places that actually have adverts. */
  async activeLocations() {
    const data = unwrap(
      await db.from('adverts').select('state, state_code, lga, city').eq('status', 'active'),
      'advert locations',
    );

    const states = new Map();
    for (const row of data ?? []) {
      if (!row.state) continue;
      const entry = states.get(row.state) ?? { state: row.state, code: row.state_code, count: 0, lgas: new Map() };
      entry.count += 1;
      if (row.lga) entry.lgas.set(row.lga, (entry.lgas.get(row.lga) ?? 0) + 1);
      states.set(row.state, entry);
    }

    return [...states.values()]
      .map((entry) => ({
        state: entry.state,
        code: entry.code,
        count: entry.count,
        lgas: [...entry.lgas.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.count - a.count);
  },
};

/** Reference data for the location pickers. */
export const locationRepository = {
  async states() {
    return unwrap(
      await db.from('ng_states').select('code, name, zone').order('name', { ascending: true }),
      'list states',
    );
  },

  async lgas(stateCode) {
    return unwrap(
      await db.from('ng_lgas').select('id, name').eq('state_code', stateCode).order('name', { ascending: true }),
      'list lgas',
    );
  },
};

export default advertRepository;
