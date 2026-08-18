/**
 * Resolves the real client IP behind Vercel's proxy layer.
 *
 * This matters twice over: rate limiting keys on it (without it every request
 * looks like it comes from the same proxy address, so one abusive client would
 * exhaust the limit for everybody), and audit records store it.
 *
 * Header precedence:
 *   1. x-vercel-forwarded-for — set by Vercel's edge, not forgeable by a client
 *   2. x-real-ip             — set by the proxy
 *   3. x-forwarded-for       — standard chain; the FIRST entry is the origin
 *   4. req.ip                — direct connection, i.e. local development
 *
 * A client can send x-forwarded-for itself, which is why the Vercel-specific
 * headers are preferred: the platform overwrites them on the way in.
 */
export const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  return (
    req.headers['x-vercel-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    (chain ?? '').split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
};

/** Standard shape for audit records — who did it, and from where. */
export const requestContext = (req) => ({
  ip: clientIp(req),
  userAgent: req.get('user-agent') ?? null,
});

export default clientIp;
