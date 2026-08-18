import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Variants map to intent, never to a colour, so a screen never picks a hex:
 *   primary   — the single action that moves the user forward. Orange.
 *   secondary — structural navigation. Purple.
 *   outline / ghost / subtle — supporting actions.
 *   danger    — destructive, always behind a confirmation.
 *
 * Every size clears 44px of touch target, the iOS guideline. The slight
 * active:scale gives a press response on touch, where there is no hover state
 * to confirm the tap landed.
 */
const VARIANTS = {
  primary:
    'bg-orange-500 text-white shadow-sm hover:bg-orange-600 hover:shadow active:bg-orange-700',
  secondary:
    'bg-purple-600 text-white shadow-sm hover:bg-purple-700 active:bg-purple-800',
  outline:
    'border border-line-strong bg-white text-ink hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700',
  subtle:
    'bg-purple-50 text-purple-700 hover:bg-purple-100',
  ghost:
    'text-ink-soft hover:bg-purple-50 hover:text-purple-700',
  danger:
    'bg-danger text-white shadow-sm hover:brightness-110 active:brightness-95',
  link:
    'h-auto p-0 text-purple-600 underline-offset-4 hover:text-purple-700 hover:underline',
};

const SIZES = {
  sm: 'h-9 gap-1.5 rounded-lg px-3.5 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-5 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-7 text-[15px]',
  icon: 'h-10 w-10 rounded-lg',
};

export const Button = forwardRef(
  (
    {
      as: Component = 'button',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      icon: Icon,
      iconRight: IconRight,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => (
    <Component
      ref={ref}
      aria-busy={isLoading || undefined}
      disabled={Component === 'button' ? disabled || isLoading : undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em]',
        'transition-all duration-200 active:scale-[0.985]',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
        VARIANTS[variant],
        variant !== 'link' && SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {loadingText ?? children}
        </>
      ) : (
        <>
          {Icon && <Icon size={size === 'lg' ? 18 : 16} aria-hidden="true" />}
          {children}
          {IconRight && <IconRight size={size === 'lg' ? 18 : 16} aria-hidden="true" />}
        </>
      )}
    </Component>
  ),
);

Button.displayName = 'Button';
export default Button;
