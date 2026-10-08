import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Hero carousel — the nine LizExpress marketing banners.
 *
 * The originals in public/Lizexpress_Ltd_images are SVG wrappers around layered
 * raster art, 2–7MB each and 41MB for the set. Serving those would have cost
 * more than the rest of the site combined on a Nigerian mobile connection, so
 * each one is pre-rendered to WebP with a JPEG fallback (~55KB each).
 * The source SVGs are kept in the repo as the masters.
 *
 * Only the first slide is eager and preloaded; the rest load lazily, so the
 * landing page paints on roughly 60KB of imagery rather than 41MB.
 */
const SLIDES = [
  { id: 3,  alt: 'Swap what you have for what you need' },
  { id: 4,  alt: 'Everyone has something to offer' },
  { id: 8,  alt: 'Shop cashlessly on LizExpress' },
  { id: 10, alt: 'Swap a backpack for sneakers' },
  { id: 11, alt: 'Trade anything and everything, cashlessly' },
  { id: 13, alt: 'Trade your wardrobe cashlessly' },
  { id: 15, alt: 'Look your best — trade cashlessly' },
  { id: 17, alt: 'Trade your appliances cashlessly' },
  { id: 19, alt: 'Trade your gadgets cashlessly' },
];

const INTERVAL = 5000;

export const Hero = () => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  const go = useCallback((index) => setCurrent((index + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setCurrent((value) => (value + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(timer);
  }, [paused]);

  // Pause while the tab is hidden — a background carousel is wasted work.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const onTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 45) go(current + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <section
      aria-label="LizExpress highlights"
      aria-roledescription="carousel"
      className="relative w-full overflow-hidden bg-canvas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/*
        Full-bleed: every slide spans the whole width, with no blurred side
        panels and no faded edges.

        Height follows the slide's own 16:9 shape, so phones and laptops see the
        whole banner uncropped. Only on wide screens, where 16:9 would be taller
        than the window, is the height capped — and the cap never trims more
        than 18% off the top and bottom. Every banner keeps its headline and
        product inside the middle 64%, so that only ever removes empty margin.
      */}
      <div className="hero-frame relative w-full">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}`}
            aria-hidden={index !== current}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              index === current ? 'z-10 opacity-100' : 'z-0 opacity-0',
            )}
          >
            <picture>
              <source srcSet={`/hero/${slide.id}.webp`} type="image/webp" />
              <img
                src={`/hero/${slide.id}.jpg`}
                alt={slide.alt}
                width={1600}
                height={900}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'low'}
                decoding={index === 0 ? 'sync' : 'async'}
                className="h-full w-full object-cover object-center"
              />
            </picture>
          </div>
        ))}

        {/* Previous / next — desktop only; phones swipe. */}
        <button
          type="button"
          onClick={() => go(current - 1)}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-canvas/80 text-ink shadow-card backdrop-blur transition hover:bg-canvas md:grid"
        >
          <span className="icon">chevron_left</span>
        </button>
        <button
          type="button"
          onClick={() => go(current + 1)}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-canvas/80 text-ink shadow-card backdrop-blur transition hover:bg-canvas md:grid"
        >
          <span className="icon">chevron_right</span>
        </button>

        {/* Progress pills: the active one stretches, the rest stay small. */}
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 sm:bottom-4">
          <div className="flex items-center gap-1.5 rounded-full bg-ink/35 px-2.5 py-1.5 backdrop-blur-sm">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === current}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300 sm:h-2',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                  index === current ? 'w-6 bg-accent-500 sm:w-8' : 'w-1.5 bg-white/70 hover:bg-white sm:w-2',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
