import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns';

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export const money = (amount, currency = 'NGN') => {
  const value = Number(amount ?? 0);
  if (currency !== 'NGN') {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  }
  return NGN.format(value);
};

/** Compact form for dense cards: ₦450k rather than ₦450,000. */
export const moneyCompact = (amount) => {
  const value = Number(amount ?? 0);
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  if (value >= 1_000) return `₦${Math.round(value / 1_000)}k`;
  return NGN.format(value);
};

export const number = (value) => new Intl.NumberFormat('en-NG').format(Number(value ?? 0));

export const timeAgo = (date) => {
  if (!date) return '';
  return `${formatDistanceToNowStrict(new Date(date))} ago`;
};

/** Chat timestamps: time for today, "Yesterday", then a date. */
export const messageTime = (date) => {
  if (!date) return '';
  const value = new Date(date);
  if (isToday(value)) return format(value, 'HH:mm');
  if (isYesterday(value)) return 'Yesterday';
  return format(value, 'd MMM');
};

export const dateLong = (date) => (date ? format(new Date(date), 'd MMMM yyyy') : '');
export const dateTime = (date) => (date ? format(new Date(date), 'd MMM yyyy, HH:mm') : '');

export const initials = (name) =>
  (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const CONDITION_LABELS = {
  new: 'Brand new',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  for_parts: 'For parts',
};

export const STATUS_LABELS = {
  draft: 'Draft',
  pending_payment: 'Awaiting payment',
  active: 'Live',
  swapped: 'Swapped',
  suspended: 'Removed',
  archived: 'Archived',
};

export const REJECTION_LABELS = {
  document_illegible: 'Document is not readable',
  document_expired: 'Document has expired',
  name_mismatch: 'Name does not match the profile',
  selfie_mismatch: 'Selfie does not match the ID',
  suspected_forgery: 'Document appears altered',
  incomplete_submission: 'Submission is incomplete',
  other: 'Other',
};
