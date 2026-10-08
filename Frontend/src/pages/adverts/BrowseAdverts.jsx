import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SmartLink as Link } from '../../components/ui/SmartLink.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { AdvertCard, AdvertCardSkeleton } from '../../components/adverts/AdvertCard.jsx';
import { useStates, useAdvertLocations } from '../../components/adverts/useLocations.js';
import { endpoints } from '../../lib/api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useViewerReactions } from '../../hooks/useEngagement.js';
import { ADVERT_CATEGORIES } from '../../lib/adverts.js';
import { number } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const PAGE_SIZE = 24;

/**
 * Browse adverts.
 *
 * Location is the product here, so the place sits inside the headline and is
 * itself the control: "Vendors and services in Ikeja, Lagos". Everything else —
 * search, categories, sort — is secondary and stays visually quiet.
 *
 * Every filter lives in the URL, so a customer can share "caterers in Surulere"
 * as a link and the back button undoes a filter instead of leaving the page.
 */
const BrowseAdverts = () => {
  const [params, setParams] = useSearchParams();
  const states = useStates();
  const locations = useAdvertLocations();

  const stateCode = params.get('stateCode') ?? '';
  const lga = params.get('lga') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const urlQuery = params.get('q') ?? '';

  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebounce(query, 350);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | more | error
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef(null);

  const stateName = states.find((state) => state.code === stateCode)?.name ?? '';
  const placeLabel = lga ? `${lga}, ${stateName || '…'}` : stateName || 'all of Nigeria';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: false });
  };

  // Typed search is written to the URL after the debounce, not per keystroke,
  // so history does not fill with one entry per letter.
  useEffect(() => {
    if (debouncedQuery !== urlQuery) update({ q: debouncedQuery.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const filters = useMemo(
    () => ({ q: urlQuery || undefined, stateCode: stateCode || undefined, lga: lga || undefined, category: category || undefined, sort }),
    [urlQuery, stateCode, lga, category, sort],
  );

  // Any filter change starts over at page 1.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus(page === 1 ? 'loading' : 'more');
    endpoints.adverts
      .search({ ...filters, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then(({ data, meta: pageMeta }) => {
        setItems((current) => (page === 1 ? data ?? [] : [...current, ...(data ?? [])]));
        setMeta(pageMeta);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });

    return () => controller.abort();
  }, [filters, page, attempt]);

  const reactions = useViewerReactions('advert', items.map((advert) => advert.id));
  const popularPlaces = locations.slice(0, 8);
  const lgaSuggestions = locations.find((entry) => entry.code === stateCode)?.lgas ?? [];
  const hasFilters = Boolean(stateCode || lga || category || urlQuery);

  return (
    <div className="container-page py-8 lg:py-12">
      <nav className="mb-6 inline-flex rounded-full border border-line bg-canvas-sunken p-1" aria-label="Marketplace">
        <Link to="/browse" className="rounded-full px-4 py-1 text-sm text-ink-muted transition-colors hover:text-ink">
          Swap items
        </Link>
        <span className="rounded-full bg-canvas px-4 py-1 text-sm font-medium text-ink shadow-xs" aria-current="page">
          Business adverts
        </span>
      </nav>

      {/* ── Headline: the place is the control ── */}
      <header className="max-w-3xl">
        <h1 className="text-title text-ink">
          Vendors and services in{' '}
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            aria-controls="place-picker"
            className="inline-flex items-baseline gap-1 rounded text-brand-600 underline decoration-brand-200 decoration-2 underline-offset-[6px] transition-colors hover:decoration-brand-600"
          >
            {placeLabel}
            <Icon name="expand_more" className={cn('self-center transition-transform', pickerOpen && 'rotate-180')} />
          </button>
        </h1>
        <p className="mt-3 text-ink-muted">
          See what local businesses offer, with photos, then call or message them directly.
        </p>
      </header>

      {pickerOpen && (
        <div id="place-picker" className="panel mt-6 grid max-w-3xl gap-4 p-4 sm:grid-cols-2 animate-fade-up">
          <div>
            <label className="label" htmlFor="filter-state">State</label>
            <select
              id="filter-state"
              className="field"
              value={stateCode}
              onChange={(event) => update({ stateCode: event.target.value, lga: '' })}
            >
              <option value="">All of Nigeria</option>
              {states.map((state) => (
                <option key={state.code} value={state.code}>{state.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="filter-lga">Local government</label>
            <input
              id="filter-lga"
              className="field"
              list="filter-lga-list"
              defaultValue={lga}
              key={stateCode}
              disabled={!stateCode}
              placeholder={stateCode ? 'Any LGA' : 'Choose a state first'}
              onBlur={(event) => update({ lga: event.target.value.trim() })}
              onKeyDown={(event) => event.key === 'Enter' && update({ lga: event.currentTarget.value.trim() })}
            />
            <datalist id="filter-lga-list">
              {lgaSuggestions.map((entry) => <option key={entry.name} value={entry.name} />)}
            </datalist>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            {(stateCode || lga) && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => update({ stateCode: '', lga: '' })}>
                Anywhere in Nigeria
              </button>
            )}
            <button type="button" className="btn-primary btn-sm" onClick={() => setPickerOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Search + sort ── */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            className="field pl-12"
            placeholder="Small chops, tailor, phone repair…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search adverts"
          />
        </div>
        <select
          className="field sm:w-48"
          value={sort}
          onChange={(event) => update({ sort: event.target.value === 'newest' ? '' : event.target.value })}
          aria-label="Sort adverts"
        >
          <option value="newest">Newest first</option>
          <option value="popular">Most viewed</option>
          <option value="price_low">Price: low to high</option>
          <option value="price_high">Price: high to low</option>
        </select>
      </div>

      {/* ── Categories ── */}
      <div className="scroller -mx-4 mt-4 scroll-px-4 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        <CategoryChip active={!category} onClick={() => update({ category: '' })}>All</CategoryChip>
        {ADVERT_CATEGORIES.map((entry) => (
          <CategoryChip
            key={entry.value}
            active={category === entry.value}
            onClick={() => update({ category: category === entry.value ? '' : entry.value })}
          >
            {entry.label}
          </CategoryChip>
        ))}
      </div>

      {/* ── Results ── */}
      <section className="mt-8" aria-live="polite" aria-busy={status === 'loading'}>
        {status !== 'loading' && meta && (
          <p className="mb-4 text-sm text-ink-muted">
            <span className="mono text-ink">{number(meta.total)}</span> {meta.total === 1 ? 'advert' : 'adverts'}
          </p>
        )}

        {status === 'loading' ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => <AdvertCardSkeleton key={index} />)}
          </div>
        ) : status === 'error' ? (
          <div className="panel p-8 text-center">
            <p className="font-medium text-ink">Adverts could not load.</p>
            <p className="mt-1 text-sm text-ink-muted">Check your connection, then try again.</p>
            <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="panel px-6 py-12 text-center">
            <Icon name="storefront" size="xl" className="text-ink-faint" />
            <p className="mt-3 text-lg font-semibold text-ink">
              No adverts {lga || stateName ? `in ${placeLabel}` : 'match this search'} yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              {lga
                ? `Try all of ${stateName}, or be the first business people find here.`
                : 'Try a different word or category, or be the first business people find here.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {lga && (
                <button type="button" className="btn-secondary" onClick={() => update({ lga: '' })}>
                  Show all of {stateName}
                </button>
              )}
              {!lga && hasFilters && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setQuery('');
                    setParams(new URLSearchParams());
                  }}
                >
                  Clear filters
                </button>
              )}
              <Link to="/dashboard/adverts/new" className="btn-accent">Advertise your business</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {items.map((advert, index) => (
                <AdvertCard
                  key={advert.id}
                  advert={advert}
                  priority={index < 4}
                  liked={reactions.liked.has(advert.id)}
                  saved={reactions.saved.has(advert.id)}
                  onToggleLike={reactions.toggleLike}
                  onToggleSave={reactions.toggleSave}
                />
              ))}
            </div>

            {meta?.hasNext && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={status === 'more'}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {status === 'more' ? 'Loading…' : 'Show more adverts'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Popular places: only when nothing is chosen yet ── */}
      {!stateCode && popularPlaces.length > 0 && (
        <section className="mt-16 border-t border-line pt-8">
          <h2 className="text-lg text-ink">Where businesses are advertising</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {popularPlaces.map((place) => (
              <li key={place.state}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => update({ stateCode: place.code, lga: '' })}
                >
                  {place.state}
                  <span className="mono text-ink-faint">{place.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── For vendors ── */}
      <aside className="mt-16 flex flex-col items-start justify-between gap-4 rounded-xl bg-brand-600 p-6 text-white sm:flex-row sm:items-center lg:p-8">
        <div>
          <h2 className="text-xl text-white">Sell something people near you need?</h2>
          <p className="mt-1 text-brand-100">
            Show your products with photos. <span className="mono">₦1,000</span> per photo, live for 30 days.
          </p>
        </div>
        <Link to="/dashboard/adverts/new" className="btn-accent shrink-0">Create an advert</Link>
      </aside>
    </div>
  );
};

const CategoryChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors',
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-line-strong bg-canvas text-ink-soft hover:border-ink-faint hover:text-ink',
    )}
  >
    {children}
  </button>
);

export default BrowseAdverts;
