import { cn } from '../../lib/cn.js';

/**
 * An empty screen is an invitation to act, not a dead end — so every empty
 * state names the next step rather than just reporting nothing is here.
 */
export const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
    {Icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
        <Icon size={24} className="text-purple-400" aria-hidden="true" />
      </div>
    )}
    <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
