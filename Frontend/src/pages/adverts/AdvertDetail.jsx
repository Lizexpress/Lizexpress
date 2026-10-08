import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmartLink as Link } from '../../components/ui/SmartLink.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Image from '../../components/ui/Image.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { AdvertCard } from '../../components/adverts/AdvertCard.jsx';
import { EngagementBar } from '../../components/engagement/EngagementBar.jsx';
import { Comments } from '../../components/engagement/Comments.jsx';
import { useEngagement } from '../../hooks/useEngagement.js';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { money, number, dateLong } from '../../lib/format.js';
import { categoryLabel, placeLine, priceLine, telLink, whatsappLink } from '../../lib/adverts.js';
import { cn } from '../../lib/cn.js';

/**
 * Advert detail.
 *
 * The phone number is behind one tap, not hidden behind a sign-in. Customers
 * came here to contact a vendor; making them register first would cost the
 * advertiser the lead they paid for. The tap exists only to count the contact,
 * which is the number the advertiser cares about most.
 */
const AdvertDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [advert, setAdvert] = useState(null);
  const [state, setState] = useState('loading');
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [nearby, setNearby] = useState([]);
  const stripRef = useRef(null);
  const engagement = useEngagement('advert', id);
  const goToComments = () => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    setState('loading');
    setActive(0);
    setRevealed(false);
    endpoints.adverts
      .detail(id)
      .then((data) => {
        setAdvert(data);
        setState('ready');
        // Similar businesses in the same LGA — a customer comparing caterers
        // should not have to go back to search to see the next one.
        endpoints.adverts
          .search({ stateCode: data.state_code, lga: data.lga, category: data.category, limit: 5 })
          .then(({ data: rows }) => setNearby((rows ?? []).filter((row) => row.id !== data.id).slice(0, 4)))
          .catch(() => {});
      })
      .catch(() => setState('missing'));
  }, [id]);

  if (state === 'loading') return <PageLoader label="Loading advert" />;

  if (state === 'missing') {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Icon name="storefront" size="xl" className="text-ink-faint" />
        <h1 className="mt-4 text-2xl">This advert is no longer available</h1>
        <p className="mt-2 text-ink-muted">It may have expired or been removed by the business.</p>
        <Link to="/adverts" className="btn-primary mt-6">Browse other adverts</Link>
      </div>
    );
  }

  const photos = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position);
  const isOwner = user?.id === advert.user_id;
  const price = priceLine(advert, money);
  const phone = advert.contact_phone;
  const whatsapp = advert.contact_whatsapp || advert.contact_phone;

  const reveal = () => {
    setRevealed(true);
    if (!isOwner) endpoints.adverts.recordContact(advert.id).catch(() => {});
  };

  /** Keeps the swipeable strip and the thumbnail selection in step. */
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

  return (
    <div className="container-page py-6 lg:py-10">
      <nav className="mb-6 text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link to="/adverts" className="inline-flex items-center gap-1 hover:text-ink">
          <Icon name="arrow_back" size="sm" />
          Adverts
        </Link>
        {advert.state_code && (
          <>
            <span className="mx-2 text-ink-faint">/</span>
            <Link to={`/adverts?stateCode=${advert.state_code}`} className="hover:text-ink">{advert.state}</Link>
            <span className="mx-2 text-ink-faint">/</span>
            <Link to={`/adverts?stateCode=${advert.state_code}&lga=${encodeURIComponent(advert.lga)}`} className="hover:text-ink">
              {advert.lga}
            </Link>
          </>
        )}
      </nav>

      {isOwner && advert.status !== 'active' && (
        <div className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={advert.status} />
            <span className="text-sm text-ink-soft">Only you can see this advert until it is live.</span>
          </div>
          <Link to={`/dashboard/adverts/${advert.id}`} className="btn-primary btn-sm">Continue setting up</Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        {/* ── Gallery ── */}
        <section aria-label="Photos">
          {photos.length > 0 ? (
            <>
              <div
                ref={stripRef}
                onScroll={onStripScroll}
                className="scroller gap-0 rounded-xl"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {photos.map((photo, index) => (
                  <figure key={photo.id} className="w-full">
                    <Image
                      src={photo.url}
                      alt={photo.caption || `${advert.title}, photo ${index + 1}`}
                      width={1200}
                      priority={index === 0}
                      className="rounded-xl"
                    />
                    {photo.caption && <figcaption className="mt-2 text-sm text-ink-muted">{photo.caption}</figcaption>}
                  </figure>
                ))}
              </div>

              {photos.length > 1 && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="scroller gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Show photo ${index + 1}`}
                        aria-current={index === active}
                        className={cn(
                          'w-16 overflow-hidden rounded-md border-2 transition-colors sm:w-20',
                          index === active ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100',
                        )}
                      >
                        <Image src={photo.url} alt="" width={160} ratio="media-square" className="rounded-none" />
                      </button>
                    ))}
                  </div>
                  <span className="mono shrink-0 text-sm text-ink-muted">
                    {active + 1}/{photos.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="media grid place-items-center rounded-xl">
              <Icon name="image" size="xl" className="text-ink-faint" />
            </div>
          )}

          <EngagementBar engagement={engagement} title={advert.title} onComment={goToComments} className="-ml-2 mt-2" />

          {/* Description and comments sit under the photos on desktop, after contact on mobile. */}
          <div className="mt-8 hidden lg:block">
            <Description advert={advert} />
            <div className="mt-12">
              <Comments type="advert" id={advert.id} ownerId={advert.user_id} onCountChange={engagement.setCommentCount} count={engagement.counts.comments} />
            </div>
          </div>
        </section>

        {/* ── Summary + contact ── */}
        <aside className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <p className="text-sm text-ink-muted">{advert.business_name}</p>
          <h1 className="mt-1 text-2xl leading-tight text-ink">{advert.title}</h1>

          {price && (
            <p className={advert.price_from ? 'mono mt-3 text-xl font-medium text-ink' : 'mt-3 text-ink-soft'}>{price}</p>
          )}

          <p className="mt-3 flex items-start gap-1 text-ink-soft">
            <Icon name="location_on" className="mt-0.5 text-ink-faint" />
            <span>
              {placeLine(advert)}
              {advert.city && advert.lga && advert.city !== advert.lga && (
                <span className="block text-sm text-ink-muted">{advert.lga} LGA</span>
              )}
            </span>
          </p>

          <div className="mt-6 grid gap-2">
            {isOwner ? (
              <>
                <div className="panel grid grid-cols-3">
                  {[
                    ['Views', engagement.counts.views || advert.view_count],
                    ['Calls', engagement.counts.contacts || advert.contact_count],
                    ['Likes', engagement.counts.likes],
                    ['Saves', engagement.counts.saves],
                    ['Comments', engagement.counts.comments],
                    ['Shares', engagement.counts.shares],
                  ].map(([label, value], index) => (
                    <div key={label} className={`p-3 ${index % 3 ? 'border-l border-line' : ''} ${index > 2 ? 'border-t border-line' : ''}`}>
                      <p className="mono text-lg font-medium text-ink">{number(value ?? 0)}</p>
                      <p className="text-xs text-ink-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <Link to={`/dashboard/adverts/${advert.id}`} className="btn-secondary">
                  <Icon name="edit" size="sm" />
                  Edit advert
                </Link>
              </>
            ) : !revealed ? (
              <button type="button" className="btn-primary" onClick={reveal}>
                <Icon name="call" size="sm" />
                Show phone number
              </button>
            ) : (
              <>
                <a href={telLink(phone)} className="btn-primary">
                  <Icon name="call" size="sm" />
                  <span className="mono">{phone}</span>
                </a>
                {whatsapp && (
                  <a
                    href={whatsappLink(whatsapp, `Hello ${advert.business_name}, I saw your advert "${advert.title}" on LizExpress.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <Icon name="chat" size="sm" />
                    Message on WhatsApp
                  </a>
                )}
              </>
            )}
          </div>

          {!isOwner && (
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Meet in a public place and see the goods before you pay. LizExpress does not handle payment between you and the business.
            </p>
          )}

          <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
            <Avatar src={advert.owner?.avatar_url} name={advert.owner?.full_name} verified={advert.owner?.is_verified} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-ink">{advert.owner?.full_name ?? advert.business_name}</p>
              <p className="text-ink-muted">
                {advert.owner?.is_verified ? 'Identity verified' : 'Identity not verified'}
              </p>
            </div>
          </div>

          {advert.expires_at && (
            <p className="mt-4 text-sm text-ink-faint">Advert live until {dateLong(advert.expires_at)}</p>
          )}
        </aside>

        <div className="lg:hidden">
          <Description advert={advert} />
          <div className="mt-12">
            <Comments type="advert" id={advert.id} ownerId={advert.user_id} onCountChange={engagement.setCommentCount} count={engagement.counts.comments} />
          </div>
        </div>
      </div>

      {nearby.length > 0 && (
        <section className="mt-16 border-t border-line pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl">More in {advert.lga}</h2>
            <Link
              to={`/adverts?stateCode=${advert.state_code}&lga=${encodeURIComponent(advert.lga)}`}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              See all
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {nearby.map((row) => <AdvertCard key={row.id} advert={row} />)}
          </div>
        </section>
      )}
    </div>
  );
};

const Description = ({ advert }) => {
  const details = [
    ['Category', categoryLabel(advert.category)],
    ['Address', advert.address],
    ['Email', advert.contact_email && <a href={`mailto:${advert.contact_email}`} className="text-brand-600 hover:underline">{advert.contact_email}</a>],
    ['Website', advert.website_url && (
      <a href={advert.website_url} target="_blank" rel="noopener noreferrer" className="break-anywhere text-brand-600 hover:underline">
        {advert.website_url.replace(/^https?:\/\//, '')}
      </a>
    )],
  ].filter(([, value]) => value);

  return (
    <>
      <h2 className="text-lg">About this business</h2>
      <p className="mt-3 max-w-[68ch] whitespace-pre-line leading-relaxed text-ink-soft">{advert.description}</p>

      {details.length > 0 && (
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="min-w-0 text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
};

export default AdvertDetail;
