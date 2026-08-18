import { ArrowRight } from 'lucide-react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import { Button } from '../ui/Button.jsx';

/** Closing banner. v1's wording, kept verbatim — it is the brand's own line. */
export const CallToAction = () => (
  <section className="section-tight bg-white">
    <div className="container-page">
      <div className="relative overflow-hidden rounded-2xl bg-orange-50 px-6 py-10 lg:px-12">
        {/* Soft brand wash rather than a flat block — adds depth without noise. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/10 blur-2xl"
        />
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <p className="max-w-xl text-center font-display text-xl font-semibold leading-snug text-ink text-balance md:text-left md:text-2xl">
            Would you like to get what you want with what you have — spending{' '}
            <span className="whitespace-nowrap text-purple-600">no cash?</span>
          </p>
          <Button as={Link} to="/list-item" size="lg" iconRight={ArrowRight} className="shrink-0">
            List your item
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default CallToAction;
