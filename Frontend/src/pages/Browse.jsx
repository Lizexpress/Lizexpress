import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ItemGrid } from '../components/items/ItemGrid.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Input.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { endpoints } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CONDITION_LABELS } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const SORTS = [
  ['newest', 'Newest first'],
  ['popular', 'Most viewed'],
  ['price_low', 'Value: low to high'],
  ['price_high', 'Value: high to low'],
];

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 400);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      category: params.get('category') || undefined,
      condition: params.get('condition') || undefined,
      state: params.get('state') || undefined,
      sort: params.get('sort') || 'newest',
      page: Number(params.get('page') ?? 1),
      limit: 20,
    }),
    [debouncedQuery, params],
  );

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      // Any filter change invalidates the current page.
      if (key !== 'page') next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    endpoints.items.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    // Abort the previous request so a slow early query cannot overwrite a fast later one.
    const controller = new AbortController();
    setIsLoading(true);

    endpoints.items
      .browse(filters, { signal: controller.signal })
      .then(({ data, meta: pageMeta }) => {
        setItems(data);
        setMeta(pageMeta);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setItems([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters]);

  const toggleFavorite = async (itemId) => {
    if (!isAuthenticated) {
      toast.info('Sign in to save items.');
      return;
    }
    setFavoriteIds((current) => {
      const next = new Set(current);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    await endpoints.items.favorite(itemId).catch(() => {});
  };

  const activeFilters = ['category', 'condition', 'state'].filter((key) => params.get(key));

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6">
        <h1 className="text-title font-bold">Browse the marketplace</h1>
        <p className="mt-1.5 text-ink-muted">
          {meta ? `${meta.total} item${meta.total === 1 ? '' : 's'} available to swap` : 'Loading listings'}
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, description, or what they want"
            aria-label="Search listings"
            className="h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-4 text-[15px] focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>

        <Select
          value={filters.sort}
          onChange={(event) => setFilter('sort', event.target.value)}
          aria-label="Sort listings"
          containerClassName="sm:w-52 sm:flex-none"
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        <Button
          variant="outline"
          icon={SlidersHorizontal}
          onClick={() => setShowFilters((value) => !value)}
          className="lg:hidden"
        >
          Filters{activeFilters.length > 0 && ` (${activeFilters.length})`}
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className={cn('space-y-6', !showFilters && 'hidden lg:block')} aria-label="Filters">
          <div>
            <h2 className="mb-2.5 text-2xs font-bold uppercase tracking-[0.11em] text-ink-faint">Category</h2>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setFilter('category', null)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                  !filters.category ? 'bg-purple-50 font-semibold text-purple-700' : 'text-ink-soft hover:bg-canvas-sunken',
                )}
              >
                All categories
              </button>
              {categories.map((entry) => (
                <button
                  key={entry.category}
                  type="button"
                  onClick={() => setFilter('category', entry.category)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                    filters.category === entry.category
                      ? 'bg-purple-50 font-semibold text-purple-700'
                      : 'text-ink-soft hover:bg-canvas-sunken',
                  )}
                >
                  <span className="truncate">{entry.category}</span>
                  <span className="ml-2 shrink-0 text-xs text-ink-faint">{entry.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2.5 text-2xs font-bold uppercase tracking-[0.11em] text-ink-faint">Condition</h2>
            <Select value={filters.condition ?? ''} onChange={(event) => setFilter('condition', event.target.value)} aria-label="Condition">
              <option value="">Any condition</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>

          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              fullWidth
              onClick={() => {
                const next = new URLSearchParams();
                if (query) next.set('q', query);
                setParams(next, { replace: true });
              }}
            >
              Clear all filters
            </Button>
          )}
        </aside>

        <div>
          <ItemGrid
            items={items}
            isLoading={isLoading}
            onToggleFavorite={toggleFavorite}
            favoriteIds={favoriteIds}
            empty={
              <EmptyState
                icon={Search}
                title="No matches"
                description={
                  query
                    ? `Nothing matched "${query}". Try a broader search or clear your filters.`
                    : 'No listings fit these filters yet. Try widening them.'
                }
              />
            }
          />

          {meta && meta.totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasPrev}
                onClick={() => setFilter('page', String(meta.page - 1))}
              >
                Previous
              </Button>
              <span className="px-3 text-sm text-ink-muted">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNext}
                onClick={() => setFilter('page', String(meta.page + 1))}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
};

export default Browse;
