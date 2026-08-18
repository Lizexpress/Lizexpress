import { BadgeCheck } from 'lucide-react';
import { initials } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const SIZES = {
  xs: 'h-7 w-7 text-2xs',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export const Avatar = ({ src, name, size = 'md', verified = false, className }) => (
  <div className={cn('relative shrink-0', className)}>
    {src ? (
      <img
        src={src}
        alt={name ?? ''}
        loading="lazy"
        decoding="async"
        className={cn('rounded-full border border-line object-cover', SIZES[size])}
      />
    ) : (
      <div
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full bg-purple-600 font-semibold uppercase tracking-wide text-white',
          SIZES[size],
        )}
      >
        {initials(name)}
      </div>
    )}

    {verified && (
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px"
        title="Identity verified"
      >
        <BadgeCheck size={size === 'xs' || size === 'sm' ? 13 : 16} className="text-success" aria-label="Verified" />
      </span>
    )}
  </div>
);

export default Avatar;
