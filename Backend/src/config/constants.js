/** Domain constants shared across layers. No logic here — values only. */

export const OTP_PURPOSE = Object.freeze({
  SIGNUP: 'signup',
  LOGIN: 'login',
  PASSWORD_RESET: 'password_reset',
  EMAIL_CHANGE: 'email_change',
});

export const USER_ROLE = Object.freeze({
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

export const ADMIN_ROLES = Object.freeze([USER_ROLE.MODERATOR, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN]);

export const ITEM_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_PAYMENT: 'pending_payment',
  ACTIVE: 'active',
  SWAPPED: 'swapped',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
  REFUNDED: 'refunded',
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RESUBMIT: 'resubmit',
});

export const NOTIFICATION_TYPE = Object.freeze({
  MESSAGE: 'message',
  SWAP_OFFER: 'swap_offer',
  VERIFICATION: 'verification',
  PAYMENT: 'payment',
  ITEM: 'item',
  SYSTEM: 'system',
});

export const REALTIME_CHANNEL = Object.freeze({
  userNotifications: (userId) => `user:${userId}:notifications`,
  chatThread: (chatId) => `chat:${chatId}`,
  adminFeed: () => 'admin:feed',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

export const REJECTION_REASONS = Object.freeze([
  'document_illegible',
  'document_expired',
  'name_mismatch',
  'selfie_mismatch',
  'suspected_forgery',
  'incomplete_submission',
  'other',
]);
