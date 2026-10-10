import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal with the accessibility work done properly:
 *  - Escape closes it
 *  - background scroll is locked while open
 *  - focus moves in on open and returns to the trigger on close
 *  - Tab is trapped inside the dialog
 *
 * On mobile it presents as a bottom sheet, which is far easier to reach
 * one-handed than a centred dialog.
 */
export const Modal = ({ open, onClose, title, description, size = 'md', footer, children }) => {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Parents usually pass an inline arrow, which is a new function on every
  // render. If the effect below depended on it, every keystroke in a field
  // inside the modal would tear the effect down, hand focus back to the button
  // that opened it, and you could type exactly one character. Read it from a
  // ref instead, so the effect runs once per open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => panelRef.current?.querySelector('[data-autofocus]')?.focus() ?? panelRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-purple-900/45 backdrop-blur-[2px] animate-fade-up"
        onClick={() => onCloseRef.current?.()}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-lift animate-fade-up',
          'rounded-t-3xl sm:rounded-2xl',
          WIDTHS[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-canvas-sunken hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer && <div className="border-t border-line bg-canvas-sunken px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
