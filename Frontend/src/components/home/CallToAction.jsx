import { SmartLink as Link } from '../ui/SmartLink.jsx';
import Icon from '../ui/Icon.jsx';

/**
 * Closing section: the brand's own line, then the two things you can do here.
 * Two doors rather than one button, so advertising is discoverable from the
 * home page and not only from the menu.
 */
const WAYS = [
  {
    icon: 'swap_horiz',
    title: 'Swap what you have',
    body: 'List something you no longer use, say what you want for it, and trade without cash.',
    to: '/list-item',
    cta: 'List an item',
    primary: true,
  },
  {
    icon: 'storefront',
    title: 'Advertise your business',
    body: 'Show your products and services to customers in your state and local government.',
    to: '/dashboard/adverts/new',
    cta: 'Create an advert',
  },
];

export const CallToAction = () => (
  <section className="py-12 lg:py-16">
    <div className="container-page">
      <h2 className="max-w-2xl text-2xl sm:text-3xl">
        Get what you want with what you have, spending no cash.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {WAYS.map((way) => (
          <div key={way.title} className="flex flex-col rounded-2xl border border-line bg-canvas p-6 lg:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name={way.icon} size="lg" />
            </span>
            <h3 className="mt-6 text-xl">{way.title}</h3>
            <p className="mt-2 flex-1 text-ink-muted">{way.body}</p>
            <Link to={way.to} className={`mt-6 self-start ${way.primary ? 'btn-primary' : 'btn-secondary'}`}>
              {way.cta}
              <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CallToAction;
