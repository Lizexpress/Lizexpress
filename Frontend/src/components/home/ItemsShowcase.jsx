import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, MapPin, ArrowLeftRight, PackageOpen } from 'lucide-react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import { Button } from '../ui/Button.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { moneyCompact, CONDITION_LABELS } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

/**
 * Live listings, immediately under the hero.
 *
 * Deliberately public: the catalogue loads and is browsable with no account.
 * Sign-in is asked for only when someone *acts* — proposing a swap or saving
 * an item. Gating the catalogue would hide the one thing that makes a visitor
 * want to join.
 */
const PER_PAGE = 5;

const CONDITION_TONE = {
  new: 'bg-success-soft text-success',
  like_new: 'bg-success-soft text-success',
  good: 'bg-orange-50 text-orange-800',
  fair: 'bg-orange-100 text-orange-800',
  for_parts: 'bg-canvas-sunken text-ink-muted',
};

const CardSkeleton = () => (
  <div className="card overflow-hidden">
    <div className="skeleton aspect-[4/3] w-full rounded-none" />
    <div className="space-y-2 p-4">
      <div className="skeleton h-3 w-16 rounded" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="skeleton h-9 w-full rounded-lg" />
    </div>
  </div>
);

const ItemTile = ({ item }) => {
  const location = [item.city, item.state].filter(Boolean).join(', ');

  return (
    <article className="card-interactive group relative flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2">
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas-sunken">
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <PackageOpen size={26} aria-hidden="true" />
          </div>
        )}

        {item.estimated_cost > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-purple-700 shadow-sm nums">
            {moneyCompact(item.estimated_cost)}
          </span>
        )}
        {item.condition && (
          <span
            className={cn(
              'absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              CONDITION_TONE[item.condition] ?? 'bg-canvas-sunken text-ink-muted',
            )}
          >
            {CONDITION_LABELS[item.condition] ?? item.condition}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">{item.category}</p>

        <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
          {/* Stretched link: whole card is clickable, one link for screen readers. */}
          <Link to={`/items/${item.id}`} className="line-clamp-2 after:absolute after:inset-0 focus:outline-none">
            {item.name}
          </Link>
        </h3>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5">
          <ArrowLeftRight size={15} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-orange-800/70">Wants</p>
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.swap_for || 'Open to offers'}</p>
          </div>
        </div>

        {location && (
          <p className="mt-3 flex items-center gap-1 text-xs text-ink-muted">
            <MapPin size={12} aria-hidden="true" />
            {location}
          </p>
        )}
      </div>
    </article>
  );
};

export const ItemsShowcase = () => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    endpoints.items
      .browse({ limit: 15, sort: 'newest' })
      .then(({ data }) => active && setItems(data ?? []))
      .catch(() => active && setItems([]))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.max(Math.ceil(items.length / PER_PAGE), 1);
  const visible = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <section className="section bg-white">
      <div className="container-page">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">Available now</p>
            <h2 className="text-heading">Items ready to swap</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Browse freely — an account is only needed once you want to make a swap.
            </p>
          </div>
          <Button as={Link} to="/browse" variant="ghost" size="sm" iconRight={ArrowRight}>
            View all
          </Button>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
            {isLoading
              ? Array.from({ length: PER_PAGE }, (_, i) => <CardSkeleton key={i} />)
              : visible.map((item) => <ItemTile key={item.id} item={item} />)}
          </div>

          {!isLoading && totalPages > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPage((p) => (p === 0 ? totalPages - 1 : p - 1))}
                aria-label="Previous items"
                className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-x-5 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink-soft shadow-card transition hover:border-purple-200 hover:text-purple-700 lg:grid"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => (p === totalPages - 1 ? 0 : p + 1))}
                aria-label="More items"
                className="absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 translate-x-5 place-items-center rounded-full border border-line bg-white text-ink-soft shadow-card transition hover:border-purple-200 hover:text-purple-700 lg:grid"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {!isLoading && totalPages > 1 && (
          <div className="mt-7 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPage(index)}
                aria-label={`Page ${index + 1}`}
                aria-current={index === page}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  index === page ? 'w-6 bg-orange-500' : 'w-2 bg-line-strong hover:bg-orange-300',
                )}
              />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-purple-50 text-purple-400">
              <PackageOpen size={24} aria-hidden="true" />
            </span>
            <h3 className="font-display text-lg font-semibold text-ink">No listings yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
              Be the first to list something and start the swapping community.
            </p>
            <Button as={Link} to="/list-item" className="mt-5">List an item</Button>
          </div>
        )}

        {!isAuthenticated && !isLoading && items.length > 0 && (
          <div className="mt-10 overflow-hidden rounded-2xl bg-purple-700">
            <div className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left lg:px-10">
              <div>
                <h3 className="font-display text-xl font-semibold text-white">Found something you want?</h3>
                <p className="mt-1.5 text-sm text-purple-100/85">
                  Create a free account to message the owner. Browsing always stays open.
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Button as={Link} to="/register">Create account</Button>
                <Button
                  as={Link}
                  to="/login"
                  variant="outline"
                  className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/20 hover:text-white"
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ItemsShowcase;
