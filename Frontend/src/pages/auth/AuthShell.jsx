import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo.jsx';
import { ArrowLeftRight } from 'lucide-react';

/**
 * Two-column auth frame. The right panel is not decoration — it carries the
 * three facts a hesitant new user needs before handing over an email, which is
 * exactly where drop-off happens. It collapses away entirely on mobile.
 */
export const AuthShell = ({ eyebrow, title, description, children, footer }) => (
  <div className="grid min-h-app lg:grid-cols-[1fr_minmax(0,44%)]">
    <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
      <Logo variant="dark" />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {eyebrow && (
          <p className="mb-2 text-2xs font-bold uppercase tracking-[0.13em] text-orange-600">{eyebrow}</p>
        )}
        <h1 className="text-title font-bold text-balance">{title}</h1>
        {description && <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{description}</p>}

        <div className="mt-7">{children}</div>

        {footer && <div className="mt-7 text-sm text-ink-muted">{footer}</div>}
      </div>

      <p className="text-xs text-ink-faint">
        © {new Date().getFullYear()} LizExpress Ltd ·{' '}
        <Link to="/terms" className="hover:text-ink-soft">Terms</Link> ·{' '}
        <Link to="/privacy" className="hover:text-ink-soft">Privacy</Link>
      </p>
    </div>

    <aside className="relative hidden overflow-hidden bg-purple-700 lg:block" aria-hidden="true">
      {/* Ambient swap marks, very low contrast — texture, not pattern-noise. */}
      <div className="absolute inset-0 opacity-[0.07]">
        {Array.from({ length: 24 }, (_, index) => (
          <ArrowLeftRight
            key={index}
            size={44}
            className="absolute text-white"
            style={{
              left: `${(index * 37) % 92}%`,
              top: `${(index * 53) % 92}%`,
              transform: `rotate(${(index * 41) % 360}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative flex h-full flex-col justify-center px-14 text-white">
        <p className="text-2xs font-bold uppercase tracking-[0.13em] text-orange-300">Why LizExpress</p>
        <h2 className="mt-3 max-w-sm font-display text-3xl font-semibold leading-[1.15] text-white text-balance">
          Cash is not the only way to get what you need.
        </h2>

        <ul className="mt-9 space-y-6">
          {[
            ['Every member is ID-checked', 'You always know who is on the other side of a swap.'],
            ['You set the terms', 'Say what you have and what you want. No haggling over price.'],
            ['Pay once, per listing', 'A 5% listing fee. No commission on the swap itself.'],
          ].map(([title, copy]) => (
            <li key={title} className="flex gap-3.5">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500">
                <ArrowLeftRight size={13} className="text-white" />
              </span>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-purple-200/85">{copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  </div>
);

export default AuthShell;
