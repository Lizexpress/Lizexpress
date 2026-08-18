/**
 * Environment loader + validator.
 * Fails fast at boot so a misconfigured deploy never serves traffic.
 */
import 'dotenv/config';

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 8080),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8080',
  appUrl: process.env.APP_URL ?? 'https://lizexpressltd.com',
  adminUrl: process.env.ADMIN_URL ?? 'https://lizexpressltd.com/admin',
  corsOrigins: list(process.env.CORS_ORIGINS),

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'lizexpress',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL ?? 'LizExpress <no-reply@lizexpressltd.com>',
    replyTo: process.env.RESEND_REPLY_TO ?? 'support@lizexpressltd.com',
  },

  otp: {
    length: int(process.env.OTP_LENGTH, 6),
    ttlMinutes: int(process.env.OTP_TTL_MINUTES, 10),
    maxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
    resendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  },

  flutterwave: {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH,
    baseUrl: 'https://api.flutterwave.com/v3',
  },

  payment: {
    currency: process.env.PAYMENT_CURRENCY ?? 'NGN',
    listingFeePercentage: Number(process.env.LISTING_FEE_PERCENTAGE ?? 5),
  },

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT ?? 'mailto:support@lizexpressltd.com',
  },

  recaptchaSecret: process.env.RECAPTCHA_SECRET_KEY,
};

export default env;
