import { SmartLink } from '../ui/SmartLink.jsx';
import { cn } from '../../lib/cn.js';

/**
 * The real LizExpress wordmark, served from the build.
 *
 * Two things were fixed getting here:
 *   • v1 hot-linked the logo from imgur. If that link rots, every page loses
 *     its branding, so the asset now lives in the repo.
 *   • The master art in preview.png was an 8334x8334 file that was almost
 *     entirely white padding. It is cropped to the mark and exported at 1x/2x.
 *
 * Two lockups, because the mark appears on both purple and white:
 *   variant="light" — purple ink recoloured white, for the purple header/footer
 *   variant="dark"  — the original orange-and-purple, for light backgrounds
 * Using the dark lockup on purple makes "Express" almost invisible.
 */
export const Logo = ({ variant = 'light', className, imgClassName }) => {
  const file = variant === 'light' ? 'logo-wordmark-light' : 'logo-wordmark';

  return (
    <SmartLink to="/" aria-label="LizExpress home" className={cn('flex flex-shrink-0 items-center', className)}>
      <img
        src={`/${file}.png`}
        srcSet={`/${file}.png 1x, /${file}@2x.png 2x`}
        alt="LizExpress"
        width={320}
        height={93}
        // The header logo is above the fold on every page — never lazy.
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        className={cn('w-auto object-contain', imgClassName ?? 'h-9 sm:h-11')}
      />
    </SmartLink>
  );
};

export default Logo;
