/**
 * Request schemas. Every field a client can send is declared here and nowhere else.
 * Error messages are written for end users, because they are shown verbatim in the UI.
 */
import { z } from 'zod';
import { OTP_PURPOSE, VERIFICATION_STATUS, ITEM_STATUS, REJECTION_REASONS, USER_ROLE } from '../config/constants.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[0-9]/, 'Include at least one number.');

const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

const uuid = z.string().uuid('Invalid identifier.');

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ── Auth ── */
export const authSchemas = {
  register: z.object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
    email,
    password,
    accountTypes: z.array(z.enum(['swapper', 'advertiser'])).min(1).max(2).optional(),
    acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue.' }) }),
  }),
  verifyEmail: z.object({ email, code: otpCode }),
  resendCode: z.object({
    email,
    purpose: z.enum([OTP_PURPOSE.SIGNUP, OTP_PURPOSE.LOGIN, OTP_PURPOSE.PASSWORD_RESET]).default(OTP_PURPOSE.SIGNUP),
  }),
  login: z.object({ email, password: z.string().min(1, 'Enter your password.') }),
  refresh: z.object({ refreshToken: z.string().min(10, 'Missing refresh token.') }),
  forgotPassword: z.object({ email }),
  verifyResetCode: z.object({ email, code: otpCode }),
  resetPassword: z.object({ resetToken: z.string().min(10), newPassword: password }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
};

/* ── Users ── */
export const userSchemas = {
  updateProfile: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    avatarUrl: z.string().url().optional().nullable(),
    residentialAddress: z.string().trim().max(300).optional(),
    dateOfBirth: z.string().date('Use the format YYYY-MM-DD.').optional(),
    language: z.string().trim().max(40).optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    country: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    zipCode: z.string().trim().max(20).optional(),
    nationality: z.string().trim().max(80).optional(),
  }),
  preferences: z.object({
    preferences: z.record(z.boolean()),
  }),
  idParam: z.object({ id: uuid }),
};

/* ── Items ── */
const itemBody = {
  name: z.string().trim().min(3, 'Give your item a clear name.').max(140),
  description: z.string().trim().min(10, 'Describe your item in at least 10 characters.').max(4000),
  category: z.string().trim().min(2, 'Choose a category.'),
  subcategory: z.string().trim().max(80).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'for_parts'], {
    errorMap: () => ({ message: 'Select the item condition.' }),
  }),
  buyingPrice: z.coerce.number().nonnegative().optional(),
  estimatedCost: z.coerce.number().positive('Enter what the item is worth today.'),
  swapFor: z.string().trim().min(3, 'Tell swappers what you want in return.').max(500),
  location: z.string().trim().max(200).optional(),
  country: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  images: z.array(z.string().url()).min(1, 'Add at least one photo.').max(8, 'You can add up to 8 photos.'),
  receiptImage: z.string().url().optional().nullable(),
};

export const itemSchemas = {
  create: z.object(itemBody),
  update: z.object(itemBody).partial(),
  idParam: z.object({ id: uuid }),
  browse: pagination.extend({
    q: z.string().trim().max(140).optional(),
    category: z.string().trim().optional(),
    condition: z.string().trim().optional(),
    country: z.string().trim().optional(),
    state: z.string().trim().optional(),
    city: z.string().trim().optional(),
    minValue: z.coerce.number().nonnegative().optional(),
    maxValue: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'oldest', 'price_low', 'price_high', 'popular']).default('newest'),
  }),
  mine: pagination.extend({ status: z.nativeEnum(ITEM_STATUS).optional() }),
};

/* ── Chat ── */
export const chatSchemas = {
  start: z.object({ itemId: uuid }),
  idParam: z.object({ id: uuid }),
  list: pagination.extend({ archived: z.coerce.boolean().default(false) }),
  sendMessage: z.object({
    content: z.string().trim().max(4000).optional(),
    attachments: z.array(z.string().url()).max(5).default([]),
    messageType: z.enum(['text', 'image', 'swap_offer', 'system']).default('text'),
    metadata: z.record(z.any()).optional(),
  }),
  typing: z.object({ isTyping: z.boolean() }),
  archive: z.object({ archived: z.boolean() }),
};

/* ── Verification ── */
export const verificationSchemas = {
  submit: z.object({
    documentType: z.enum(['national_id', 'passport', 'drivers_license', 'voters_card'], {
      errorMap: () => ({ message: 'Select which document you are uploading.' }),
    }),
    documentNumber: z.string().trim().min(4, 'Enter the document number.').max(60),
    identityDocument: z.string().min(4, 'Upload the front of your ID.'),
    identityDocumentBack: z.string().optional(),
    addressDocument: z.string().optional(),
    selfieImage: z.string().min(4, 'Upload a selfie holding your ID.'),
  }),
  idParam: z.object({ id: uuid }),
  queue: pagination.extend({
    status: z.union([z.nativeEnum(VERIFICATION_STATUS), z.literal('all')]).default(VERIFICATION_STATUS.PENDING),
    search: z.string().trim().max(80).optional(),
    sort: z.enum(['submitted_at', 'created_at']).default('submitted_at'),
    order: z.enum(['asc', 'desc']).default('asc'),
  }),
  decide: z.object({
    decision: z.enum(['approve', 'reject']),
    reason: z.enum(REJECTION_REASONS).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  resubmit: z.object({ notes: z.string().trim().min(10, 'Tell the applicant what to fix.').max(1000) }),
};

/* ── Payments ── */
export const paymentSchemas = {
  initialise: z.object({ itemId: uuid }),
  confirm: z.object({ txRef: z.string().min(6), transactionId: z.union([z.string(), z.number()]) }),
  refParam: z.object({ txRef: z.string().min(6) }),
};

/* ── Notifications / push ── */
export const notificationSchemas = {
  list: pagination.extend({ unreadOnly: z.coerce.boolean().default(false) }),
  idParam: z.object({ id: uuid }),
  subscribe: z.object({
    subscription: z.object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    }),
    platform: z.enum(['web', 'ios', 'android']).default('web'),
    deviceId: z.string().max(120).optional(),
  }),
  unsubscribe: z.object({ endpoint: z.string().url() }),
};

/* ── Admin ── */
export const adminSchemas = {
  listUsers: pagination.extend({
    search: z.string().trim().max(80).optional(),
    status: z.enum(['all', 'verified', 'unverified', 'suspended', 'pending_verification']).optional(),
    country: z.string().trim().optional(),
    role: z.nativeEnum(USER_ROLE).optional(),
    sort: z.enum(['created_at', 'full_name', 'last_seen_at']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
  idParam: z.object({ id: uuid }),
  suspend: z.object({ suspended: z.boolean(), reason: z.string().trim().max(500).optional() }),
  setRole: z.object({ role: z.nativeEnum(USER_ROLE) }),
  invite: z.object({
    email,
    fullName: z.string().trim().min(2).max(120),
    role: z.enum([USER_ROLE.MODERATOR, USER_ROLE.ADMIN]),
  }),
  itemStatus: z.object({ status: z.nativeEnum(ITEM_STATUS), reason: z.string().trim().max(500).optional() }),
  createTask: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    dueDate: z.string().datetime().optional(),
    assigneeId: uuid.optional(),
  }),
  updateTask: z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    assigneeId: uuid.optional().nullable(),
  }),
  setting: z.object({ key: z.string().trim().min(2).max(80), value: z.any() }),
  timeseries: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }),
  auditLog: pagination.extend({
    actorId: uuid.optional(),
    action: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
  }),
  feedback: pagination.extend({
    status: z.enum(['new', 'reviewed', 'approved', 'dismissed']).optional(),
    type: z.string().trim().optional(),
  }),
};

/* ── Feedback (public) ── */
export const feedbackSchemas = {
  create: z.object({
    type: z.enum(['bug', 'suggestion', 'testimonial', 'complaint', 'other']).default('suggestion'),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    message: z.string().trim().min(5, 'Tell us a little more.').max(2000),
    pageUrl: z.string().max(500).optional(),
  }),
};

/* ── Advertising + onboarding ── */
export * from './advert.validators.js';
