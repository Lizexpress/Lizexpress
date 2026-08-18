import { ItemCard } from './ItemCard.jsx';
import { ItemGridSkeleton } from '../ui/Skeleton.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { PackageOpen } from 'lucide-react';

export const ItemGrid = ({ items, isLoading, onToggleFavorite, favoriteIds = new Set(), showStatus, empty }) => {
  if (isLoading) return <ItemGridSkeleton />;

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
    <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          showStatus={showStatus}
          onToggleFavorite={onToggleFavorite}
          isFavorited={favoriteIds.has(item.id)}
        />
      ))}
    </div>
  );
};

export default ItemGrid;
