import { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * User-uploaded photo.
 *
 * Three things here, each fixing a specific cause of the sluggishness on
 * image-heavy pages:
 *
 *  1. The box is reserved by aspect-ratio BEFORE the image loads. Without it,
 *     every arriving photo resizes its cell and reflows the whole grid — which
 *     reads as jank even on a fast connection.
 *
 *  2. loading="lazy" + decoding="async" keeps off-screen photos out of the
 *     critical path and decodes them off the main thread, so scrolling does
 *     not stall on a large JPEG.
 *
 *  3. Supabase render transforms resize server-side. A 4MB phone photo
 *     delivered at card size is the actual payload problem; `width` asks the
 *     CDN for the size being displayed instead.
 */
export default function Image({
  src,
  alt = '',
  ratio = 'media',
  width,
  className,
  imgClassName,
  priority = false,
  fallback = null,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const optimised = (() => {
    if (!src || !width) return src;
    // Supabase storage supports on-the-fly resizing via /render/image/.
    if (!src.includes('/storage/v1/object/public/')) return src;
    const rendered = src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    return `${rendered}?width=${width}&quality=78&resize=cover`;
  })();

  return (
    <div className={cn('media', ratio !== 'media' && ratio, className)} {...rest}>
      {!loaded && !failed && <div className="media-skeleton" />}

      {failed
        ? (fallback ?? (
            <div className="absolute inset-0 grid place-items-center text-ink-faint">
              <span className="icon icon-lg">image_not_supported</span>
            </div>
          ))
        : (
          <img
            src={optimised}
            alt={alt}
            data-loaded={loaded ? 'true' : 'false'}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={imgClassName}
          />
        )}
    </div>
  );
}
