import { cn } from '../../lib/cn.js';

export const Skeleton = ({ className }) => <div className={cn('skeleton', className)} aria-hidden="true" />;

/**
 * Card placeholder matched to the real ItemCard's proportions.
 * A skeleton with different dimensions causes a layout jump when data lands,
 * which reads as jank even though the load was fast.
 */
const ItemCardSkeleton = () => (
  <div aria-hidden="true">
    <Skeleton className="aspect-square w-full rounded-xl" />
    <Skeleton className="mt-3 h-4 w-3/4" />
    <Skeleton className="mt-2 h-3 w-1/2" />
    <Skeleton className="mt-2 h-3 w-2/5" />
  </div>
);

export const ItemGridSkeleton = ({ count = 8 }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: count }, (_, index) => (
      <ItemCardSkeleton key={index} />
    ))}
  </div>
);

export const RowsSkeleton = ({ count = 6 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className="h-16 w-full rounded-xl" />
    ))}
  </div>
);

export default Skeleton;
