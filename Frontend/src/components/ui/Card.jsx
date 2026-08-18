import { cn } from '../../lib/cn.js';

/**
 * One card language for the whole product — marketplace and admin alike.
 * `interactive` is only for cards where the entire surface is a link target;
 * a hover lift on a static panel is noise.
 */
export const Card = ({ as: Component = 'div', interactive = false, padded = false, className, children, ...props }) => (
  <Component
    className={cn(interactive ? 'card-interactive' : 'card', padded && 'p-5', className)}
    {...props}
  >
    {children}
  </Component>
);

export const CardHeader = ({ title, description, action, className }) => (
  <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
    <div className="min-w-0">
      <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardBody = ({ className, children }) => <div className={cn('p-5', className)}>{children}</div>;

export const CardFooter = ({ className, children }) => (
  <div className={cn('border-t border-line bg-canvas-sunken px-5 py-3.5', className)}>{children}</div>
);

/**
 * Metric tile used across the dashboards. Kept here so the marketplace
 * dashboard and the admin console cannot drift into two different looks.
 */
export const StatCard = ({ icon: Icon, label, value, sub, tone = 'purple', className, ...props }) => {
  const tones = {
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
  };

  return (
    <Card className={cn('p-5', className)} {...props}>
      {Icon && (
        <span className={cn('mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <p className="font-display text-2xl font-semibold text-ink nums">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
};

export default Card;
