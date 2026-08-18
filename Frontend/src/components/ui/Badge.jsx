import { cn } from '../../lib/cn.js';

const TONES = {
  neutral: 'bg-purple-50 text-purple-700 border-purple-100',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-orange-50 text-orange-800 border-orange-200',
  danger: 'bg-danger-soft text-danger border-danger/20',
  muted: 'bg-canvas-sunken text-ink-muted border-line',
  accent: 'bg-orange-500 text-white border-transparent',
};

export const Badge = ({ tone = 'neutral', icon: Icon, size = 'md', className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border font-semibold',
      size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
      TONES[tone],
      className,
    )}
  >
    {Icon && <Icon size={size === 'sm' ? 11 : 12} aria-hidden="true" />}
    {children}
  </span>
);

/** Maps listing status to a tone so the meaning is consistent everywhere. */
export const StatusBadge = ({ status, size }) => {
  const config = {
    active: { tone: 'success', label: 'Live' },
    draft: { tone: 'muted', label: 'Draft' },
    pending_payment: { tone: 'warning', label: 'Awaiting payment' },
    swapped: { tone: 'neutral', label: 'Swapped' },
    suspended: { tone: 'danger', label: 'Removed' },
    archived: { tone: 'muted', label: 'Archived' },
    pending: { tone: 'warning', label: 'Awaiting review' },
    under_review: { tone: 'neutral', label: 'Being reviewed' },
    approved: { tone: 'success', label: 'Approved' },
    rejected: { tone: 'danger', label: 'Rejected' },
    resubmit: { tone: 'warning', label: 'More info needed' },
    successful: { tone: 'success', label: 'Paid' },
    failed: { tone: 'danger', label: 'Failed' },
    refunded: { tone: 'muted', label: 'Refunded' },
  }[status] ?? { tone: 'muted', label: status };

  return <Badge tone={config.tone} size={size}>{config.label}</Badge>;
};

export default Badge;
