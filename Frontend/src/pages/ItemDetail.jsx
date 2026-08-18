import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, MapPin, Eye, MessageCircle, Share2, ChevronLeft, ChevronRight, Flag, ArrowLeftRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Badge, StatusBadge } from '../components/ui/Badge.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { money, CONDITION_LABELS, timeAgo, dateLong } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isVerified, user } = useAuth();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    endpoints.items
      .detail(id)
      .then((data) => active && setItem(data))
      .catch(() => active && setItem(null))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
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

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: item.name, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied.');
  };

  if (isLoading) return <PageLoader label="Loading listing" />;

  if (!item) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="This listing is no longer available"
          description="It may have been swapped or removed by its owner."
          action={<Button as={Link} to="/browse">Browse other items</Button>}
        />
      </div>
    );
  }

  const images = item.images ?? [];
  const location = [item.city, item.state, item.country].filter(Boolean).join(', ');
  const isOwner = item.user_id === user?.id;

  return (
    <div className="container-page py-6 lg:py-10">
      <Button as={Link} to="/browse" variant="ghost" size="sm" icon={ChevronLeft} className="mb-4 -ml-2">
        Back to browse
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-canvas-sunken">
            {images.length ? (
              <img
                src={images[activeImage]}
                alt={`${item.name} — photo ${activeImage + 1} of ${images.length}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-faint">
                <ArrowLeftRight size={40} />
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImage((index) => (index - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition hover:bg-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImage((index) => (index + 1) % images.length)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition hover:bg-white"
                  aria-label="Next photo"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`View photo ${index + 1}`}
                  aria-current={index === activeImage}
                  className={cn(
                    'h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    index === activeImage ? 'border-purple-500' : 'border-line hover:border-line-strong',
                  )}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">About this item</h2>
            <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{item.description}</p>
          </section>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{item.category}</Badge>
            <Badge tone="muted">{CONDITION_LABELS[item.condition] ?? item.condition}</Badge>
            {item.status !== 'active' && <StatusBadge status={item.status} />}
          </div>

          <h1 className="mt-3 text-title font-bold text-balance">{item.name}</h1>

          <p className="mt-3 font-display text-2xl font-semibold text-purple-700">
            {money(item.estimated_cost)}
            <span className="ml-2 text-sm font-normal text-ink-muted">estimated value</span>
          </p>

          {/* The swap pair again, at full size — it is the offer, so it leads. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-orange-200 bg-canvas-warm">
            <div className="flex items-center gap-2 border-b border-orange-200/70 px-5 py-3">
              <ArrowLeftRight size={17} className="text-orange-600" />
              <p className="text-2xs font-bold uppercase tracking-[0.11em] text-orange-800/80">Wants in return</p>
            </div>
            <p className="px-5 py-4 text-[15px] font-medium leading-relaxed text-ink">
              {item.swap_for || 'Open to any reasonable offer'}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye size={14} aria-hidden="true" />
              {item.view_count} views
            </span>
            {item.published_at && <span>Listed {timeAgo(item.published_at)}</span>}
          </div>

          {!isOwner && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" icon={MessageCircle} onClick={startChat} isLoading={isStarting} className="flex-1">
                Propose a swap
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.info('Sign in to save items.');
                    return;
                  }
                  setIsFavorited((value) => !value);
                  endpoints.items.favorite(item.id).catch(() => {});
                }}
                aria-pressed={isFavorited}
                aria-label={isFavorited ? 'Remove from saved' : 'Save item'}
                className="px-4"
              >
                <Heart size={18} fill={isFavorited ? 'currentColor' : 'none'} className={cn(isFavorited && 'text-danger')} />
              </Button>
              <Button size="lg" variant="outline" onClick={share} aria-label="Share listing" className="px-4">
                <Share2 size={18} />
              </Button>
            </div>
          )}

          {isOwner && (
            <div className="mt-6 flex gap-2">
              <Button as={Link} to="/dashboard/listings" size="lg" variant="secondary" className="flex-1">
                Manage this listing
              </Button>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-line bg-white p-5">
            <p className="mb-3 text-2xs font-bold uppercase tracking-[0.11em] text-ink-faint">Listed by</p>
            <Link to={`/users/${item.owner?.id}`} className="flex items-center gap-3">
              <Avatar src={item.owner?.avatar_url} name={item.owner?.full_name} size="lg" verified={item.owner?.is_verified} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{item.owner?.full_name ?? 'LizExpress member'}</p>
                <p className="text-sm text-ink-muted">
                  {item.owner?.is_verified ? 'Identity verified' : 'Not yet verified'}
                  {item.owner?.created_at && ` · Joined ${dateLong(item.owner.created_at)}`}
                </p>
              </div>
            </Link>
          </div>

          <p className="mt-5 rounded-xl bg-canvas-sunken px-4 py-3 text-xs leading-relaxed text-ink-muted">
            Keep conversations and arrangements on LizExpress. Meet in a public place, and inspect an item before you
            hand yours over. We cannot help with deals arranged off-platform.
          </p>

          <button
            type="button"
            onClick={() => toast.info('Thanks — our team will review this listing.')}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-faint transition hover:text-danger"
          >
            <Flag size={12} />
            Report this listing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
