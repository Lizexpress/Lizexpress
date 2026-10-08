import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SmartLink as Link } from '../components/ui/SmartLink.jsx';
import Icon from '../components/ui/Icon.jsx';
import { ItemGrid } from '../components/items/ItemGrid.jsx';
import { useStates } from '../components/adverts/useLocations.js';
import { endpoints } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { CONDITION_LABELS, number } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const SORTS = [
  ['newest', 'Newest'],
  ['popular', 'Most viewed'],
  ['price_low', 'Value: low to high'],
  ['price_high', 'Value: high to low'],
];

/**
 * Browse swap items.
 *
 * The grid gets the full width — the old sidebar spent a quarter of the screen
 * on a list of eight words. Categories are a chip row (the same pattern as
 * adverts), condition and state are two compact selects, and every active
 * filter shows as a chip you can tap off. All of it lives in the URL, so a
 * search can be shared and the back button undoes a filter.
 */
const Browse = () => {
  const [params, setParams] = useSearchParams();
  const states = useStates();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 400);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      category: params.get('category') || undefined,
      condition: params.get('condition') || undefined,
      state: params.get('state') || undefined,
      sort: params.get('sort') || 'newest',
      page: Number(params.get('page') ?? 1),
      limit: 24,
    }),
    [debouncedQuery, params],
  );

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      setParams(next, { replace: key === 'q' });
    },
    [params, setParams],
  );

  // Typed search lands in the URL after the debounce, not per keystroke.
  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQuery) setFilter('q', debouncedQuery.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    endpoints.items.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    // Abort the previous request so a slow early query cannot overwrite a fast later one.
    const controller = new AbortController();
    setIsLoading(true);
    setFailed(false);
    endpoints.items
      .browse(filters, { signal: controller.signal })
      .then(({ data, meta: pageMeta }) => {
        setItems(data ?? []);
        setMeta(pageMeta);
        setIsLoading(false);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setItems([]);
        setFailed(true);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [filters, attempt]);

  useEffect(() => {
    if (filters.page > 1) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page]);

  const active = [
    filters.category && { key: 'category', label: filters.category },
    filters.condition && { key: 'condition', label: CONDITION_LABELS[filters.condition] ?? filters.condition },
    filters.state && { key: 'state', label: filters.state },
  ].filter(Boolean);

  const clearAll = () => {
    setQuery('');
    setParams(new URLSearchParams(filters.sort !== 'newest' ? { sort: filters.sort } : {}));
  };

  return (
    <div className="container-page py-8 lg:py-12">
      {/* ── Two marketplaces, one switch ── */}
      <nav className="mb-6 inline-flex rounded-full border border-line bg-canvas-sunken p-1" aria-label="Marketplace">
        <span className="rounded-full bg-canvas px-4 py-1 text-sm font-medium text-ink shadow-xs" aria-current="page">
          Swap items
        </span>
        <Link to="/adverts" className="rounded-full px-4 py-1 text-sm text-ink-muted transition-colors hover:text-ink">
          Business adverts
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title">Find something to swap</h1>
          <p className="mt-2 text-ink-muted">
            {meta ? (
              <>
                <span className="mono text-ink">{number(meta.total)}</span> {meta.total === 1 ? 'item' : 'items'} available,
                no cash needed
              </>
            ) : (
              'Loading items'
            )}
          </p>
        </div>
        <Link to="/list-item" className="btn-primary">
          <Icon name="add" size="sm" />
          List an item
        </Link>
      </header>

      {/* ── Search + sort ── */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items or what people want"
            aria-label="Search items"
            className="field pl-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <select
            className="field sm:w-40"
            value={filters.condition ?? ''}
            onChange={(event) => setFilter('condition', event.target.value)}
            aria-label="Condition"
          >
            <option value="">Condition</option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="field sm:w-40"
            value={filters.state ?? ''}
            onChange={(event) => setFilter('state', event.target.value)}
            aria-label="State"
          >
            <option value="">State</option>
            {states.map((state) => (
              <option key={state.code} value={state.name}>{state.name}</option>
            ))}
          </select>
          <select
            className="field col-span-2 sm:col-span-1 sm:w-44"
            value={filters.sort}
            onChange={(event) => setFilter('sort', event.target.value === 'newest' ? '' : event.target.value)}
            aria-label="Sort"
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Categories ── */}
      <div className="scroller -mx-4 mt-4 scroll-px-4 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        <Chip active={!filters.category} onClick={() => setFilter('category', null)}>All</Chip>
        {categories.map((entry) => (
          <Chip
            key={entry.category}
            active={filters.category === entry.category}
            onClick={() => setFilter('category', filters.category === entry.category ? null : entry.category)}
          >
            {entry.category}
            <span className={cn('mono text-xs', filters.category === entry.category ? 'text-brand-100' : 'text-ink-faint')}>
              {entry.count}
            </span>
          </Chip>
        ))}
      </div>

      {/* ── Active filters ── */}
      {(active.length > 0 || filters.q) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.q && (
            <RemovableChip
              label={`“${filters.q}”`}
              onRemove={() => {
                setQuery('');
                setFilter('q', null);
              }}
            />
          )}
          {active.map((entry) => (
            <RemovableChip key={entry.key} label={entry.label} onRemove={() => setFilter(entry.key, null)} />
          ))}
          <button type="button" onClick={clearAll} className="text-sm font-medium text-brand-600 hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* ── Results ── */}
      <section className="mt-8" aria-live="polite" aria-busy={isLoading}>
        {failed ? (
          <div className="panel p-8 text-center">
            <p className="font-medium text-ink">Items could not load.</p>
            <p className="mt-1 text-sm text-ink-muted">Check your connection, then try again.</p>
            <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <ItemGrid
            items={items}
            isLoading={isLoading}
            skeletonCount={12}
            empty={
              <div className="panel px-6 py-12 text-center">
                <Icon name="search" size="xl" className="text-ink-faint" />
                <p className="mt-3 text-lg font-semibold text-ink">No items match</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                  {filters.q ? `Nothing matched “${filters.q}”.` : 'Nothing fits these filters yet.'} Try fewer filters, or
                  list what you have and let swappers come to you.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {(active.length > 0 || filters.q) && (
                    <button type="button" className="btn-secondary" onClick={clearAll}>Clear filters</button>
                  )}
                  <Link to="/list-item" className="btn-primary">List an item</Link>
                </div>
              </div>
            }
          />
        )}

        {meta && meta.totalPages > 1 && !isLoading && (
          <Pagination meta={meta} onChange={(page) => setFilter('page', page > 1 ? String(page) : null)} />
        )}
      </section>
    </div>
  );
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors',
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-line-strong bg-canvas text-ink-soft hover:border-ink-faint hover:text-ink',
    )}
  >
    {children}
  </button>
);

const RemovableChip = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-3 pr-1 text-sm text-brand-700">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="grid h-6 w-6 place-items-center rounded-full hover:bg-brand-100"
    >
      <Icon name="close" size="sm" />
    </button>
  </span>
);

/** Numbered pages with gaps: 1 … 4 5 6 … 12. */
const Pagination = ({ meta, onChange }) => {
  const { page, totalPages } = meta;
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        className="btn-ghost btn-sm"
        disabled={!meta.hasPrev}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon name="chevron_left" />
      </button>
      {pages.map((value, index) => (
        <span key={value} className="flex items-center">
          {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-ink-faint">…</span>}
          <button
            type="button"
            onClick={() => onChange(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cn(
              'mono grid h-9 min-w-[36px] place-items-center rounded-full px-2 text-sm transition-colors',
              value === page ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-canvas-sunken',
            )}
          >
            {value}
          </button>
        </span>
      ))}
      <button
        type="button"
        className="btn-ghost btn-sm"
        disabled={!meta.hasNext}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <Icon name="chevron_right" />
      </button>
    </nav>
  );
};

export default Browse;
