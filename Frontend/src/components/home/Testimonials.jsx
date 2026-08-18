import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
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
    <section className="section bg-orange-50">
      <div className="container-page">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-1.5">From the community</p>
          <h2 className="text-heading">What our swappers say</h2>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <figure className="rounded-lg bg-white p-6 text-center shadow-sm sm:p-8">
            {current.rating > 0 && (
              <div className="mb-3 flex justify-center gap-0.5" aria-label={`${current.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={cn(i < current.rating ? 'fill-orange-500 text-orange-500' : 'text-gray-300')}
                  />
                ))}
              </div>
            )}

            <blockquote className="text-[15px] leading-relaxed text-gray-700">"{current.message}"</blockquote>

            <figcaption className="mt-5 flex items-center justify-center gap-3">
              {current.user?.avatar_url && (
                <img
                  src={current.user.avatar_url}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-purple-600">
                  {current.user?.full_name ?? 'LizExpress member'}
                </p>
                {current.user?.city && <p className="text-xs text-gray-500">{current.user.city}</p>}
              </div>
            </figcaption>
          </figure>

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous testimonial"
                className="absolute left-0 top-1/2 hidden -translate-x-5 -translate-y-1/2 rounded-full bg-white p-2 shadow-md hover:bg-gray-50 sm:block"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next testimonial"
                className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-5 rounded-full bg-white p-2 shadow-md hover:bg-gray-50 sm:block"
              >
                <ChevronRight size={20} />
              </button>

              <div className="mt-5 flex justify-center gap-2">
                {items.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Testimonial ${index + 1}`}
                    className={cn('h-2 w-2 rounded-full transition-colors', index === active ? 'bg-orange-500' : 'bg-gray-300')}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
