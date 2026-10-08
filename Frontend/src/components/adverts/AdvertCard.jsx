import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Image from '../ui/Image.jsx';
import Icon from '../ui/Icon.jsx';
import { money } from '../../lib/format.js';
import { placeLine, priceLine } from '../../lib/adverts.js';

/**
 * Photo-led advert tile.
 *
 * No box around it: the photo is the frame. Vendors are judged on what their
 * work looks like, so the image gets the space and the text stays small and
 * steady underneath. Business name first, because that is who you would call.
 */
export const AdvertCard = ({ advert, priority = false }) => {
  const cover = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position)[0];
  const price = priceLine(advert, money);
  const extra = (advert.photos?.length ?? 0) - 1;

  return (
    <Link to={`/adverts/${advert.id}`} className="group block rounded-lg focus-visible:ring-offset-4">
      <div className="relative">
        <Image
          src={cover?.url}
          alt={cover?.caption || advert.title}
          width={480}
          priority={priority}
          className="transition-opacity duration-200 group-hover:opacity-90"
        />
        {extra > 0 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-white backdrop-blur">
            <Icon name="photo_library" size="sm" />
            <span className="mono">{extra + 1}</span>
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate text-sm text-ink-muted">{advert.business_name}</p>
        <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-ink group-hover:text-brand-700">
          {advert.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <Icon name="location_on" size="sm" className="text-ink-faint" />
          <span className="truncate">{placeLine(advert)}</span>
        </p>
        {price && (
          // Mono only for figures — a written price note stays in Archivo.
          <p className={advert.price_from ? 'mono mt-1 text-sm font-medium text-ink' : 'mt-1 text-sm text-ink-soft'}>{price}</p>
        )}
      </div>
    </Link>
  );
};

export const AdvertCardSkeleton = () => (
  <div aria-hidden="true">
    <div className="media"><div className="media-skeleton" /></div>
    <div className="skeleton mt-3 h-3 w-1/3" />
    <div className="skeleton mt-2 h-4 w-4/5" />
    <div className="skeleton mt-2 h-3 w-1/2" />
  </div>
);

export default AdvertCard;
