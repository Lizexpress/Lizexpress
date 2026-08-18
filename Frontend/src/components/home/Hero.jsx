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
      className="relative w-full overflow-hidden bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/*
        Ambient backdrop for the space either side of the slide on wide screens.
        A flat white frame boxed in the purple and orange banners with a hard
        edge; a blurred, scaled copy of the current slide always harmonises,
        whatever that slide's palette is.

        Only rendered from lg upward — below the width cap there is no gap to
        fill, so a phone never pays for it. It is decorative and already in
        cache from the slide itself.
      */}
      <div className="absolute inset-0 hidden lg:block" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <img
            key={`bg-${slide.id}`}
            src={`/hero/${slide.id}.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 h-full w-full scale-125 object-cover blur-3xl transition-opacity duration-700',
              index === current ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
      </div>
      {/*
        These banners are finished artwork with the headline baked into the
        image, so they must never be cropped — a crop cuts the message off.

        Height is therefore controlled by capping the WIDTH and centring, not by
        capping the height. Clamping height while the width kept growing pushed
        the frame to 2.4:1 at 1440px and 3.2:1 at 1920px, and object-cover then
        sliced the top and bottom off every slide. Below ~1080px this is
        full-bleed and the cap does nothing, which is why mobile was already
        correct.
      */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px]">
        <div
          className="relative aspect-[16/9] w-full overflow-hidden"
          style={{
            // Feathered edges: the slide dissolves into the blurred backdrop
            // instead of ending on a hard vertical line.
            maskImage:
              'linear-gradient(to right, transparent 0, #000 3.5%, #000 96.5%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, #000 3.5%, #000 96.5%, transparent 100%)',
          }}
        >
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
                className="h-full w-full object-contain"
              />
            </picture>
          </div>
        ))}

        {/* Indicator pill, carried over from v1 — orange marks the active slide. */}
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 sm:bottom-6">
          <div className="flex gap-2.5 rounded-full bg-black/40 px-3.5 py-2 backdrop-blur-sm sm:gap-3 sm:px-4">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === current}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-all duration-300 sm:h-3 sm:w-3',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                  index === current ? 'scale-125 bg-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-orange-500/70',
                )}
              />
            ))}
          </div>
        </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
