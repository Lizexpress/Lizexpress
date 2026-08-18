import { cn } from '../../lib/cn.js';

export const Skeleton = ({ className }) => <div className={cn('skeleton', className)} aria-hidden="true" />;

/**
 * Card placeholder matched to the real ItemCard's proportions.
 * A skeleton with different dimensions causes a layout jump when data lands,
 * which reads as jank even though the load was fast.
 */
const ItemCardSkeleton = () => (
  <div className="card overflow-hidden">
    <Skeleton className="aspect-[4/3] w-full rounded-none" />
    <div className="space-y-2.5 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  </div>
);

export const ItemGridSkeleton = ({ count = 8 }) => (
  <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
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
