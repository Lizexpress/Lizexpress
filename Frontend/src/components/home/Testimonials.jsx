import { useEffect, useState } from 'react';
import { endpoints } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';

/**
 * Testimonials are real approved feedback from the moderation queue.
 *
 * v1 fabricated these client-side from chat rows with a rotating list of
 * invented quotes. That is not something to carry forward — if nobody has left
 * approved feedback, the section simply does not render.
 */
export const Testimonials = () => {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    endpoints.system
      .testimonials()
      .then((data) => live && setItems(Array.isArray(data) ? data : []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  if (!items.length) return null;

  const move = (delta) => setActive((value) => (value + delta + items.length) % items.length);
  const current = items[active];

  return (
    <section className="bg-canvas-sunken py-12 lg:py-16">
      <div className="container-page">
        <h2 className="text-center text-2xl">What our members say</h2>

        <div className="mx-auto mt-8 max-w-2xl">
          <figure className="rounded-2xl border border-line bg-canvas p-6 text-center sm:p-8">
            {current.rating > 0 && (
              <div className="mb-3 flex justify-center gap-0.5 text-accent-500" aria-label={`${current.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={cn('icon', i < current.rating ? 'icon-filled' : 'text-line-strong')}>star</span>
                ))}
              </div>
            )}

            {/* break-words: a pasted link or long word must wrap, not widen the page. */}
            <blockquote className="break-words text-lg leading-relaxed text-ink-soft">“{current.message}”</blockquote>

            <figcaption className="mt-6 flex items-center justify-center gap-3">
              {current.user?.avatar_url && (
                <img src={current.user.avatar_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              )}
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium text-ink">{current.user?.full_name ?? 'LizExpress member'}</p>
                {current.user?.city && <p className="truncate text-xs text-ink-muted">{current.user.city}</p>}
              </div>
            </figcaption>
          </figure>

          {items.length > 1 && (
            // Arrows sit beside the dots, not outside the card, so they never
            // hang off the edge of a small screen.
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous testimonial"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong bg-canvas text-ink-soft hover:text-ink"
              >
                <span className="icon">chevron_left</span>
              </button>
              <div className="flex min-w-0 flex-wrap justify-center gap-1.5">
                {items.slice(0, 12).map((entry, index) => (
                  <button
                    key={entry.id ?? index}
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Testimonial ${index + 1}`}
                    aria-current={index === active}
                    className={cn('h-2 rounded-full transition-all', index === active ? 'w-6 bg-accent-500' : 'w-2 bg-line-strong')}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next testimonial"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong bg-canvas text-ink-soft hover:text-ink"
              >
                <span className="icon">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
