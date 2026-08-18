import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

export const Spinner = ({ size = 20, className }) => (
  <Loader2 size={size} className={cn('animate-spin text-purple-500', className)} aria-hidden="true" />
);

export const PageLoader = ({ label = 'Loading' }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
    <Spinner size={26} />
    <p className="text-sm text-ink-muted">{label}</p>
  </div>
);

export default Spinner;
