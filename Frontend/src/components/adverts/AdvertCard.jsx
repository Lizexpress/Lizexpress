import { useState } from 'react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Image from '../ui/Image.jsx';
import Icon from '../ui/Icon.jsx';
import { money, number } from '../../lib/format.js';
import { placeLine, priceLine } from '../../lib/adverts.js';
import { cn } from '../../lib/cn.js';

/**
 * Photo-led advert tile.
 *
 * No box around it: the photo is the frame. Vendors are judged on what their
 * work looks like, so the image gets the space and the text stays small and
 * steady underneath. Business name first, because that is who you would call.
 * Likes and comments show as a quiet line, the way a post shows its reach.
 */
export const AdvertCard = ({ advert, priority = false, liked = false, saved = false, onToggleLike, onToggleSave }) => {
  const [likes, setLikes] = useState(advert.like_count ?? 0);
  const cover = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position)[0];
  const price = priceLine(advert, money);
  const photoCount = advert.photos?.length ?? 0;

  const like = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLikes((count) => Math.max(count + (liked ? -1 : 1), 0));
    const result = await onToggleLike?.(advert.id);
    if (result?.counts) setLikes(result.counts.likes);
    else if (result === null) setLikes(advert.like_count ?? 0);
  };

  const save = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleSave?.(advert.id);
  };

  return (
    <article className="group relative min-w-0">
      <div className="relative">
        <Image
          src={cover?.url}
          alt={cover?.caption || advert.title}
          width={520}
          priority={priority}
          className="rounded-xl"
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        {photoCount > 1 && (
          <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 text-xs text-white backdrop-blur">
            <Icon name="photo_library" size="sm" />
            <span className="mono">{photoCount}</span>
          </span>
        )}
        {(onToggleLike || onToggleSave) && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1">
            {onToggleSave && <CardButton icon="bookmark" active={saved} activeClass="text-brand-600" label={saved ? 'Remove from saved' : 'Save'} onClick={save} />}
            {onToggleLike && <CardButton icon="favorite" active={liked} activeClass="text-danger" label={liked ? 'Unlike' : 'Like'} onClick={like} />}
          </div>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate text-sm text-ink-muted">{advert.business_name}</p>
        <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-ink group-hover:text-brand-700">
          <Link to={`/adverts/${advert.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
            {advert.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <Icon name="location_on" size="sm" className="shrink-0 text-ink-faint" />
          <span className="truncate">{placeLine(advert)}</span>
        </p>
        <div className="mt-1 flex items-center gap-3">
          {price && (
            // Mono only for figures — a written price note stays in Archivo.
            <p className={cn('min-w-0 truncate text-sm', advert.price_from ? 'mono font-medium text-ink' : 'text-ink-soft')}>{price}</p>
          )}
          {likes > 0 && (
            // Likes only: the price matters more on a card than the comment count.
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-ink-faint">
              <Icon name="favorite" size="sm" filled />
              <span className="mono text-xs">{number(likes)}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

const CardButton = ({ icon, active, activeClass, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={label}
    className={cn(
      'grid h-9 w-9 place-items-center rounded-full bg-canvas/90 shadow-xs backdrop-blur transition hover:bg-canvas active:scale-90',
      active ? activeClass : 'text-ink-soft hover:text-ink',
    )}
  >
    <Icon name={icon} filled={active} size="sm" />
  </button>
);

export const AdvertCardSkeleton = () => (
  <div aria-hidden="true">
    <div className="media rounded-xl"><div className="media-skeleton" /></div>
    <div className="skeleton mt-3 h-3 w-1/3" />
    <div className="skeleton mt-2 h-4 w-4/5" />
    <div className="skeleton mt-2 h-3 w-1/2" />
  </div>
);

export default AdvertCard;
