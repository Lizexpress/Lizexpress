import { cn } from '../../lib/cn.js';

/**
 * The exchange mark. Two arrows tracing a closed loop — drawn rather than
 * borrowed from an icon set, because this mark carries the product's whole
 * idea and appears on every listing. Stroke weight matches lucide's 2px so it
 * sits correctly beside the rest of the icon language.
 */
export const SwapGlyph = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden="true"
    {...props}
  >
    <path d="M4 8h13" />
    <path d="m14 5 3 3-3 3" />
    <path d="M20 16H7" />
    <path d="m10 13-3 3 3 3" />
  </svg>
);

export default SwapGlyph;
