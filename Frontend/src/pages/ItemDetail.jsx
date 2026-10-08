import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SmartLink as Link } from '../components/ui/SmartLink.jsx';
import Icon from '../components/ui/Icon.jsx';
import Image from '../components/ui/Image.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { EngagementBar } from '../components/engagement/EngagementBar.jsx';
import { Comments } from '../components/engagement/Comments.jsx';
import { useEngagement } from '../hooks/useEngagement.js';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { money, number, CONDITION_LABELS, timeAgo, dateLong } from '../lib/format.js';
import { cn } from '../lib/cn.js';

/**
 * Swap item detail — the same structure as an advert page, so the two halves
 * of the marketplace feel like one product: photos and the conversation on the
 * left, the decision on the right.
 */
const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isVerified, user } = useAuth();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [state, setState] = useState('loading');
  const [active, setActive] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const stripRef = useRef(null);
  const engagement = useEngagement('item', id);

  useEffect(() => {
    let alive = true;
    setState('loading');
    setActive(0);
    endpoints.items
      .detail(id)
      .then((data) => {
        if (!alive) return;
        setItem(data);
        setState('ready');
      })
      .catch(() => alive && setState('missing'));
    return () => {
      alive = false;
    };
  }, [id]);

  const startChat = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/items/${id}` } } });
      return;
    }
    if (!isVerified) {
      toast.info('Verify your identity to message swappers.');
      navigate('/id-verification');
      return;
    }
    setIsStarting(true);
    try {
      const chat = await endpoints.chats.start(id);
      navigate(`/chats/${chat.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsStarting(false);
    }
  };

  if (state === 'loading') return <PageLoader label="Loading item" />;

  if (state === 'missing') {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Icon name="swap_horiz" size="xl" className="text-ink-faint" />
        <h1 className="mt-4 text-2xl">This item is no longer available</h1>
        <p className="mt-2 text-ink-muted">It may have been swapped or removed by its owner.</p>
        <Link to="/browse" className="btn-primary mt-6">Browse other items</Link>
      </div>
    );
  }

  const images = item.images ?? [];
  const place = [item.city, item.state].filter(Boolean).join(', ');
  const isOwner = item.user_id === user?.id;
  const value = Number(item.estimated_cost) > 0 ? money(item.estimated_cost) : null;
  const condition = CONDITION_LABELS[item.condition] ?? item.condition;
  const goToComments = () => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });

  const goTo = (index) => {
    setActive(index);
    const strip = stripRef.current;
    if (strip) strip.scrollTo({ left: strip.clientWidth * index, behavior: 'smooth' });
  };

  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip) return;
    const index = Math.round(strip.scrollLeft / strip.clientWidth);
    if (index !== active) setActive(index);
  };

  const description = (
    <>
      <h2 className="text-lg">About this item</h2>
      <p className="mt-3 max-w-[68ch] whitespace-pre-line leading-relaxed text-ink-soft">
        {item.description || 'No description yet.'}
      </p>
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        {[
          ['Category', item.category],
          ['Condition', condition],
          ['Location', place],
          ['Listed', item.published_at && timeAgo(item.published_at)],
        ]
          .filter(([, entry]) => entry)
          .map(([label, entry]) => (
            <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink">{entry}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-12">
        <Comments type="item" id={item.id} ownerId={item.user_id} onCountChange={engagement.setCommentCount} count={engagement.counts.comments} />
      </div>
    </>
  );

  return (
    <div className="container-page py-6 lg:py-10">
      <nav className="mb-6 text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link to="/browse" className="inline-flex items-center gap-1 hover:text-ink">
          <Icon name="arrow_back" size="sm" />
          Swap items
        </Link>
        {item.category && (
          <>
            <span className="mx-2 text-ink-faint">/</span>
            <Link to={`/browse?category=${encodeURIComponent(item.category)}`} className="hover:text-ink">{item.category}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <section aria-label="Photos">
          {images.length > 0 ? (
            <div className="relative">
              <div ref={stripRef} onScroll={onStripScroll} className="scroller gap-0 rounded-xl">
                {images.map((src, index) => (
                  <div key={src} className="w-full">
                    <Image
                      src={src}
                      alt={`${item.name}, photo ${index + 1} of ${images.length}`}
                      width={1200}
                      priority={index === 0}
                      className="rounded-xl"
                    />
                  </div>
                ))}
              </div>
              {images.length > 1 && (
                <>
                  <GalleryArrow side="left" onClick={() => goTo((active - 1 + images.length) % images.length)} />
                  <GalleryArrow side="right" onClick={() => goTo((active + 1) % images.length)} />
                  <span className="mono absolute bottom-3 right-3 rounded-full bg-ink/60 px-2 py-0.5 text-xs text-white">
                    {active + 1}/{images.length}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="media grid place-items-center rounded-xl">
              <Icon name="swap_horiz" size="xl" className="text-ink-faint" />
            </div>
          )}

          {images.length > 1 && (
            <div className="scroller mt-3 gap-2">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={index === active}
                  className={cn(
                    'w-16 overflow-hidden rounded-md border-2 transition sm:w-20',
                    index === active ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100',
                  )}
                >
                  <Image src={src} alt="" width={160} ratio="media-square" className="rounded-none" />
                </button>
              ))}
            </div>
          )}

          <EngagementBar engagement={engagement} title={item.name} onComment={goToComments} className="-ml-2 mt-2" />

          <div className="mt-8 hidden lg:block">{description}</div>
        </section>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            {condition && <span className="badge-neutral">{condition}</span>}
            {item.status !== 'active' && <StatusBadge status={item.status} size="sm" />}
          </div>

          <h1 className="mt-3 text-2xl leading-tight text-ink sm:text-3xl">{item.name}</h1>

          {value && (
            <p className="mt-2 text-ink-muted">
              <span className="mono text-xl font-medium text-ink">{value}</span> estimated value
            </p>
          )}

          {/* What they want is the offer itself, so it leads the decision. */}
          <div className="mt-6 rounded-xl bg-accent-50 p-4">
            <p className="flex items-center gap-1 text-sm font-medium text-accent-700">
              <Icon name="swap_horiz" size="sm" />
              Wants in return
            </p>
            <p className="mt-1 text-lg leading-snug text-ink">{item.swap_for || 'Open to any fair offer'}</p>
          </div>

          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            {place && (
              <span className="inline-flex items-center gap-1">
                <Icon name="location_on" size="sm" className="text-ink-faint" />
                {place}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="visibility" size="sm" className="text-ink-faint" />
              <span className="mono">{number(engagement.counts.views || item.view_count)}</span> views
            </span>
          </p>

          <div className="mt-6 grid gap-2">
            {isOwner ? (
              <>
                <div className="panel grid grid-cols-3">
                  {[
                    ['Views', engagement.counts.views || item.view_count],
                    ['Chats', engagement.counts.contacts],
                    ['Likes', engagement.counts.likes],
                    ['Saves', engagement.counts.saves],
                    ['Comments', engagement.counts.comments],
                    ['Shares', engagement.counts.shares],
                  ].map(([label, count], index) => (
                    <div key={label} className={cn('p-3', index % 3 && 'border-l border-line', index > 2 && 'border-t border-line')}>
                      <p className="mono text-lg font-medium text-ink">{number(count ?? 0)}</p>
                      <p className="text-xs text-ink-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <Link to="/dashboard/listings" className="btn-secondary">Manage this listing</Link>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={startChat} disabled={isStarting}>
                <Icon name="chat_bubble" size="sm" />
                {isStarting ? 'Opening chat…' : 'Propose a swap'}
              </button>
            )}
          </div>

          <Link to={`/users/${item.owner?.id}`} className="mt-6 flex items-center gap-3 border-t border-line pt-6">
            <Avatar src={item.owner?.avatar_url} name={item.owner?.full_name} verified={item.owner?.is_verified} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-ink">{item.owner?.full_name ?? 'LizExpress member'}</p>
              <p className="text-ink-muted">
                {item.owner?.is_verified ? 'Identity verified' : 'Identity not verified'}
                {item.owner?.created_at && `, joined ${dateLong(item.owner.created_at)}`}
              </p>
            </div>
            <Icon name="chevron_right" size="sm" className="ml-auto text-ink-faint" />
          </Link>

          {!isOwner && (
            <>
              <p className="mt-6 text-sm leading-relaxed text-ink-muted">
                Keep arrangements on LizExpress. Meet in a public place and inspect an item before you hand yours over.
              </p>
              <button
                type="button"
                onClick={() => toast.info('Thanks. Our team will review this listing.')}
                className="mt-3 inline-flex items-center gap-1 text-sm text-ink-faint transition hover:text-danger"
              >
                <Icon name="flag" size="sm" />
                Report this listing
              </button>
            </>
          )}
        </aside>

        <div className="lg:hidden">{description}</div>
      </div>
    </div>
  );
};

const GalleryArrow = ({ side, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
    className={cn(
      'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-canvas/90 text-ink shadow-card backdrop-blur transition hover:bg-canvas sm:grid',
      side === 'left' ? 'left-3' : 'right-3',
    )}
  >
    <Icon name={side === 'left' ? 'chevron_left' : 'chevron_right'} />
  </button>
);

export default ItemDetail;
