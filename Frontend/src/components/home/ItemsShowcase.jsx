import { useEffect, useRef, useState } from 'react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Icon from '../ui/Icon.jsx';
import { ItemCard, ItemCardSkeleton } from '../items/ItemCard.jsx';
import { AdvertCard, AdvertCardSkeleton } from '../adverts/AdvertCard.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useViewerReactions } from '../../hooks/useEngagement.js';
import { cn } from '../../lib/cn.js';

/**
 * Live listings under the hero: swap items, then business adverts.
 *
 * Each is a swipeable row rather than a paged grid. On a phone a row of
 * cards you can flick through is how every shopping app behaves; on desktop
 * the arrows scroll by one screenful. Both stay fully public — an account is
 * asked for only when someone acts.
 */
const useRow = () => {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };

  const scroll = (direction) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return { ref, edges, update, scroll };
};

const Row = ({ title, description, to, linkLabel, loading, count, children, skeleton }) => {
  const row = useRow();

  useEffect(() => {
    row.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, loading]);

  return (
    <section className="py-12 lg:py-16">
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl">{title}</h2>
            <p className="mt-1 text-ink-muted">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={to} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {linkLabel}
            </Link>
            <div className="ml-2 hidden gap-2 md:flex">
              <ArrowButton icon="chevron_left" label="Scroll back" disabled={row.edges.start} onClick={() => row.scroll(-1)} />
              <ArrowButton icon="chevron_right" label="Scroll forward" disabled={row.edges.end} onClick={() => row.scroll(1)} />
            </div>
          </div>
        </div>

        <div
          ref={row.ref}
          onScroll={row.update}
          className="scroller -mx-4 scroll-px-4 gap-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
        >
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="w-[44%] sm:w-[30%] lg:w-[calc((100%-96px)/5)]">{skeleton}</div>
              ))
            : children}
        </div>
      </div>
    </section>
  );
};

const ArrowButton = ({ icon, label, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-canvas text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-40"
  >
    <Icon name={icon} />
  </button>
);

const SLOT = 'w-[44%] shrink-0 sm:w-[30%] lg:w-[calc((100%-96px)/5)]';

export const ItemsShowcase = () => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [adverts, setAdverts] = useState([]);
  const [loading, setLoading] = useState({ items: true, adverts: true });

  useEffect(() => {
    let active = true;
    endpoints.items
      .browse({ limit: 15, sort: 'newest' })
      .then(({ data }) => active && setItems(data ?? []))
      .catch(() => {})
      .finally(() => active && setLoading((current) => ({ ...current, items: false })));
    endpoints.adverts
      .search({ limit: 10, sort: 'newest' })
      .then(({ data }) => active && setAdverts(data ?? []))
      .catch(() => {})
      .finally(() => active && setLoading((current) => ({ ...current, adverts: false })));
    return () => {
      active = false;
    };
  }, []);

  const { liked, saved, toggleLike, toggleSave } = useViewerReactions('item', items.map((item) => item.id));

  return (
    <>
      {(loading.items || items.length > 0) && (
        <Row
          title="Fresh swaps"
          description="Newly listed. Browse freely; you only need an account to make an offer."
          to="/browse"
          linkLabel="See all items"
          loading={loading.items}
          count={items.length}
          skeleton={<ItemCardSkeleton />}
        >
          {items.map((item, index) => (
            <div key={item.id} className={SLOT}>
              <ItemCard
                item={item}
                priority={index < 2}
                liked={liked.has(item.id)}
                saved={saved.has(item.id)}
                onToggleLike={toggleLike}
                onToggleSave={toggleSave}
              />
            </div>
          ))}
        </Row>
      )}

      {!loading.items && items.length === 0 && (
        <section className="py-12">
          <div className="container-page">
            <div className="panel flex flex-col items-center px-6 py-12 text-center">
              <Icon name="swap_horiz" size="xl" className="text-ink-faint" />
              <h2 className="mt-3 text-lg">No listings yet</h2>
              <p className="mt-1 max-w-sm text-sm text-ink-muted">Be the first to list something and start the swapping community.</p>
              <Link to="/list-item" className="btn-primary mt-6">List an item</Link>
            </div>
          </div>
        </section>
      )}

      {adverts.length > 0 && (
        <div className="bg-canvas-sunken">
          <Row
            title="Businesses near you"
            description="Vendors and services advertising on LizExpress. See their work, then call them."
            to="/adverts"
            linkLabel="See all adverts"
            loading={loading.adverts}
            count={adverts.length}
            skeleton={<AdvertCardSkeleton />}
          >
            {adverts.map((advert) => (
              <div key={advert.id} className={SLOT}>
                <AdvertCard advert={advert} />
              </div>
            ))}
          </Row>
        </div>
      )}

      {!isAuthenticated && !loading.items && items.length > 0 && (
        <section className="py-12 lg:py-16">
          <div className="container-page">
            <div className={cn('flex flex-col items-start gap-6 rounded-2xl bg-brand-600 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8')}>
              <div>
                <h2 className="text-xl text-white">Found something you want?</h2>
                <p className="mt-1 text-brand-100">Create a free account to message owners, like, save and comment.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to="/register" className="btn-accent">Create account</Link>
                <Link to="/login" className="btn border border-white/30 text-white hover:bg-white/10">Sign in</Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default ItemsShowcase;
