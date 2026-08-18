import { db, unwrap } from './base.repository.js';

/**
 * OTP codes are stored hashed, single-use, and expiring.
 * Any earlier live code for the same (email, purpose) is invalidated when a new one is issued,
 * so a user can never have two valid codes in flight.
 */
export const otpRepository = {
  async invalidateActive(email, purpose) {
    await db
      .from('auth_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .eq('purpose', purpose)
      .is('consumed_at', null);
  },

  async create({ email, purpose, codeHash, salt, expiresAt, userId, ipAddress, userAgent }) {
    return unwrap(
      await db
        .from('auth_otp_codes')
        .insert({
          email: email.toLowerCase(),
          purpose,
          code_hash: codeHash,
          salt,
          expires_at: expiresAt,
          user_id: userId ?? null,
          ip_address: ipAddress ?? null,
          user_agent: userAgent ?? null,
        })
        .select('id, email, purpose, expires_at, created_at')
        .single(),
      'create otp',
    );
  },

  async findActive(email, purpose) {
    return unwrap(
      await db
        .from('auth_otp_codes')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('purpose', purpose)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'find otp',
    );
  },

  async findLatest(email, purpose) {
    return unwrap(
      await db
        .from('auth_otp_codes')
        .select('id, created_at')
        .eq('email', email.toLowerCase())
        .eq('purpose', purpose)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'find latest otp',
    );
  },

  async incrementAttempts(id) {
    const row = unwrap(
      await db.from('auth_otp_codes').select('attempts').eq('id', id).single(),
      'read otp attempts',
    );
    const attempts = (row?.attempts ?? 0) + 1;
    await db.from('auth_otp_codes').update({ attempts }).eq('id', id);
    return attempts;
  },

  async consume(id) {
    await db
      .from('auth_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', id);
  },

  /** Housekeeping for the scheduled cleanup function. */
  async purgeExpired(olderThanIso) {
    await db.from('auth_otp_codes').delete().lt('expires_at', olderThanIso);
  },
};

export default otpRepository;
