import { memo } from 'react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import { Heart, MapPin, Eye, ArrowLeftRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { Badge, StatusBadge } from '../ui/Badge.jsx';
import { moneyCompact, CONDITION_LABELS, timeAgo } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

/**
 * The listing card.
 *
 * The design decision that matters here: a swap listing is not a product
 * listing. A price tag alone tells you nothing — what you actually need to know
 * is "what do they have, and what do they want for it". So the card is built
 * around that pair, with the wanted item given equal visual weight to the
 * offered one and the exchange glyph between them. Everything else on the card
 * is deliberately quiet so this reads first.
 */
const ItemCardComponent = ({ item, onToggleFavorite, isFavorited = false, showStatus = false, className }) => {
  const [cover] = item.images ?? [];
  const location = [item.city, item.state].filter(Boolean).join(', ');

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden card',
        'transition-all duration-300 ease-swap hover:-translate-y-1 hover:border-purple-200 hover:shadow-lift',
        'focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas-sunken">
        {cover ? (
          <img
            src={cover}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-swap group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <ArrowLeftRight size={30} />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone="accent" size="sm">{moneyCompact(item.estimated_cost)}</Badge>
          {showStatus && <StatusBadge status={item.status} size="sm" />}
        </div>

        {onToggleFavorite && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onToggleFavorite(item.id);
            }}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? `Remove ${item.name} from saved` : `Save ${item.name}`}
            className={cn(
              'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-all',
              'focus-visible:ring-2 focus-visible:ring-orange-500',
              isFavorited ? 'bg-white text-danger' : 'bg-purple-900/35 text-white hover:bg-white hover:text-danger',
            )}
          >
            <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
          {item.category}
          {item.condition && <> · {CONDITION_LABELS[item.condition] ?? item.condition}</>}
        </p>

        <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
          {/* Stretched link: the whole card is clickable, but only one link exists for screen readers. */}
          <Link to={`/items/${item.id}`} className="line-clamp-2 after:absolute after:inset-0 focus:outline-none">
            {item.name}
          </Link>
        </h3>

        {/* ── The swap pair ── */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-canvas-warm px-3 py-2.5">
          <ArrowLeftRight size={17} className="text-orange-600" />
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-wider text-orange-800/70">Wants</p>
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.swap_for || 'Open to offers'}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3.5">
          <Avatar src={item.owner?.avatar_url} name={item.owner?.full_name} size="xs" verified={item.owner?.is_verified} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-soft">
            {item.owner?.full_name ?? 'LizExpress member'}
          </span>
          {location && (
            <span className="flex shrink-0 items-center gap-0.5 text-2xs text-ink-muted">
              <MapPin size={11} aria-hidden="true" />
              {location}
            </span>
          )}
        </div>

        {(item.view_count > 0 || item.published_at) && (
          <div className="mt-2 flex items-center gap-3 border-t border-line pt-2 text-2xs text-ink-faint">
            {item.view_count > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={11} aria-hidden="true" />
                {item.view_count}
              </span>
            )}
            {item.published_at && <span>{timeAgo(item.published_at)}</span>}
          </div>
        )}
      </div>
    </article>
  );
};

/** Memoised: browse grids re-render on every filter keystroke otherwise. */
export const ItemCard = memo(ItemCardComponent);
export default ItemCard;
