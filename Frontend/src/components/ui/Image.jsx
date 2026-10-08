import { useEffect, useState } from 'react';
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
/**
 * Supabase's on-the-fly resizing (/render/image/) is a paid-plan feature. On
 * the free plan those URLs fail, which is exactly how every listed photo turned
 * into a placeholder. So resizing is OFF unless VITE_SUPABASE_IMAGE_TRANSFORMS
 * is "true", and even when it is on, a failed resized URL falls back to the
 * original photo before giving up.
 */
const TRANSFORMS_ON = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';

const resized = (src, width) => {
  if (!TRANSFORMS_ON || !src || !width) return src;
  if (!src.includes('/storage/v1/object/public/')) return src;
  const rendered = src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  return `${rendered}${rendered.includes('?') ? '&' : '?'}width=${width}&quality=78&resize=cover`;
};

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
  const optimised = resized(src, width);
  const [current, setCurrent] = useState(optimised);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);

  // A new photo (gallery change, recycled card) starts over.
  useEffect(() => {
    setCurrent(optimised);
    setLoaded(false);
    setFailed(!src);
  }, [optimised, src]);

  const onError = () => {
    // First failure on a resized URL: try the original photo.
    if (current !== src && src) {
      setCurrent(src);
      return;
    }
    setFailed(true);
  };

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
            src={current}
            alt={alt}
            data-loaded={loaded ? 'true' : 'false'}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            onError={onError}
            className={imgClassName}
          />
        )}
    </div>
  );
}
