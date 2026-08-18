import crypto from 'node:crypto';

/**
 * Cryptographically uniform numeric OTP (no modulo bias).
 */
export const generateOtp = (length = 6) => {
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte >= 250) continue; // reject the non-uniform tail
    out += String(byte % 10);
  }
  return out;
};

/** OTPs are never stored in plaintext. */
export const hashOtp = (code, salt) =>
  crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** Constant-time compare to keep verification free of timing signals. */
export const safeEqual = (a = '', b = '') => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const sha512Hex = (payload) => crypto.createHash('sha512').update(payload).digest('hex');
