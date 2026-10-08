import { memo, useState } from 'react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Icon from '../ui/Icon.jsx';
import Image from '../ui/Image.jsx';
import { StatusBadge } from '../ui/Badge.jsx';
import { money, number, CONDITION_LABELS } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

/**
 * Swap item card.
 *
 * Photo first and large, because people decide on the photo. Under it, the two
 * things a swapper needs, in order: what it is, and what the owner wants for
 * it. Value and place sit on one quiet line. Category and condition are not
 * shouted in capitals — condition rides on the photo as a small tag, the way
 * every modern marketplace does it.
 *
 * The heart is a LIKE (a public signal the owner sees); saving to your list is
 * the bookmark. A value of zero is not printed — "₦0" read as "free".
 */
const ItemCardComponent = ({
  item,
  liked = false,
  saved = false,
  onToggleLike,
  onToggleSave,
  showStatus = false,
  priority = false,
  className,
}) => {
  const [likeCount, setLikeCount] = useState(item.like_count ?? 0);
  const cover = item.images?.[0];
  const place = item.city || item.state;
  const condition = CONDITION_LABELS[item.condition] ?? item.condition;
  const value = Number(item.estimated_cost) > 0 ? money(item.estimated_cost) : null;

  const like = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLikeCount((count) => Math.max(count + (liked ? -1 : 1), 0));
    const result = await onToggleLike?.(item.id);
    if (result?.counts) setLikeCount(result.counts.likes);
    else if (result === null) setLikeCount(item.like_count ?? 0);
  };

  const save = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleSave?.(item.id);
  };

  return (
    <article className={cn('group relative min-w-0', className)}>
      <div className="relative">
        <Image
          src={cover}
          alt={item.name}
          width={520}
          ratio="media-square"
          priority={priority}
          className="rounded-xl"
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          fallback={
            <div className="absolute inset-0 grid place-items-center text-ink-faint">
              <Icon name="swap_horiz" size="xl" />
            </div>
          }
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {condition && <span className="badge bg-canvas/90 text-ink backdrop-blur">{condition}</span>}
            {showStatus && <StatusBadge status={item.status} size="sm" />}
          </div>
        </div>

        {(onToggleLike || onToggleSave) && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1">
            {onToggleSave && (
              <IconButton icon="bookmark" active={saved} activeClass="text-brand-600" label={saved ? 'Remove from saved' : 'Save'} onClick={save} />
            )}
            {onToggleLike && (
              <IconButton icon="favorite" active={liked} activeClass="text-danger" label={liked ? 'Unlike' : 'Like'} onClick={like} />
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        <h3 className="truncate text-base font-semibold text-ink">
          {/* Stretched link: the whole card opens the item, one link for screen readers. */}
          <Link to={`/items/${item.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
            {item.name}
          </Link>
        </h3>

        <p className="mt-1 flex min-w-0 items-center gap-1 text-sm text-ink-soft">
          <Icon name="swap_horiz" size="sm" className="shrink-0 text-accent-600" />
          <span className="truncate">
            <span className="text-ink-muted">Wants </span>
            {item.swap_for || 'any fair offer'}
          </span>
        </p>

        <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-ink-muted">
          {value && <span className="mono shrink-0 text-ink">{value}</span>}
          {value && place && <span aria-hidden="true" className="text-line-strong">|</span>}
          {place && <span className="truncate">{place}</span>}
          {likeCount > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-ink-faint">
              <Icon name="favorite" size="sm" filled />
              <span className="mono text-xs">{number(likeCount)}</span>
            </span>
          )}
        </p>
      </div>
    </article>
  );
};

const IconButton = ({ icon, active, activeClass, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={label}
    className={cn(
      'grid h-9 w-9 place-items-center rounded-full bg-canvas/90 shadow-xs backdrop-blur transition hover:bg-canvas active:scale-90',
      // One colour per state; listing both let the grey win over red.
      active ? activeClass : 'text-ink-soft hover:text-ink',
    )}
  >
    <Icon name={icon} filled={active} size="sm" />
  </button>
);

export const ItemCardSkeleton = () => (
  <div aria-hidden="true">
    <div className="media media-square rounded-xl"><div className="media-skeleton" /></div>
    <div className="skeleton mt-3 h-4 w-3/4" />
    <div className="skeleton mt-2 h-3 w-1/2" />
    <div className="skeleton mt-2 h-3 w-2/5" />
  </div>
);

/** Memoised: browse grids re-render on every filter keystroke otherwise. */
export const ItemCard = memo(ItemCardComponent);
export default ItemCard;
