import { cn } from '../../lib/cn';

/**
 * Material Symbols Rounded.
 *
 * One variable font replaces lucide-react and react-icons — roughly 60KB of
 * JavaScript, re-parsed on every route change, becomes a cached font file the
 * browser rasterises once. Removing those two packages is the single biggest
 * win available on the "images and icons feel laggy" complaint.
 *
 * Icon names are the Google names verbatim: fonts.google.com/icons
 *
 *   <Icon name="check_circle" />
 *   <Icon name="favorite" filled />
 *   <Icon name="search" size="lg" className="text-ink-muted" />
 *
 * Decorative by default — aria-hidden, so a screen reader does not announce
 * the literal ligature text ("check_circle") next to the label it sits beside.
 * Pass `label` only when the icon is the sole content of a control.
 */
export default function Icon({ name, filled = false, size = 'md', className, label, ...rest }) {
  const sizeClass = { sm: 'icon-sm', md: '', lg: 'icon-lg', xl: 'icon-xl' }[size] ?? '';

  return (
    <span
      className={cn('icon', filled && 'icon-filled', sizeClass, className)}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      translate="no"
      {...rest}
    >
      {name}
    </span>
  );
}
