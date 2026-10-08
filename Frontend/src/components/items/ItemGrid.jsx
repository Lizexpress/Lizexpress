import { ItemCard, ItemCardSkeleton } from './ItemCard.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { useViewerReactions } from '../../hooks/useEngagement.js';
import { PackageOpen } from 'lucide-react';

export const GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4';

/**
 * The item grid used everywhere items are listed. It fetches the viewer's
 * likes and saves for the whole page in one request, so every card's heart
 * and bookmark are right on first paint.
 */
export const ItemGrid = ({ items, isLoading, showStatus, empty, interactive = true, skeletonCount = 8 }) => {
  const ids = (items ?? []).map((item) => item.id);
  const { liked, saved, toggleLike, toggleSave } = useViewerReactions('item', ids);

  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: skeletonCount }, (_, index) => <ItemCardSkeleton key={index} />)}
      </div>
    );
  }

  if (!items?.length) {
    return (
      empty ?? (
        <EmptyState
          icon={PackageOpen}
          title="Nothing here yet"
          description="Try widening your filters, or be the first to list something in this category."
        />
      )
    );
  }

  return (
    <div className={GRID}>
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          showStatus={showStatus}
          priority={index < 4}
          liked={liked.has(item.id)}
          saved={saved.has(item.id)}
          onToggleLike={interactive ? toggleLike : undefined}
          onToggleSave={interactive ? toggleSave : undefined}
        />
      ))}
    </div>
  );
};

export default ItemGrid;
