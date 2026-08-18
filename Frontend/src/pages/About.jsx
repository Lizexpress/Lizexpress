import { Link } from 'react-router-dom';
import { MapPin, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';

const About = () => (
  <div className="container-page py-12 lg:py-20">
    <header className="max-w-2xl">
      <h1 className="text-title font-bold text-balance">Trade should not depend on having cash to hand</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        LizExpress started in Kano with a simple observation: most households own things they no longer use, and want
        things they cannot easily afford. Those two facts should cancel each other out.
      </p>
    </header>

    <div className="mt-12 grid gap-8 md:grid-cols-2 lg:gap-12">
      <section>
        <h2 className="font-display text-xl font-semibold">What we do</h2>
        <p className="mt-2.5 leading-relaxed text-ink-soft">
          We run a marketplace where members list what they have and state what they want in return. There is no
          bidding, no price negotiation, and no commission on the trade itself — just a small fee to publish a listing.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Why verification matters</h2>
        <p className="mt-2.5 leading-relaxed text-ink-soft">
          Barter only works when both sides trust each other. Every member passes a manual identity check before they
          can list an item or send a message, and our team reviews each submission individually.
        </p>
      </section>
    </div>

    <div className="mt-14 flex flex-col gap-4 rounded-2xl border border-line bg-canvas-sunken p-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5 text-sm text-ink-soft">
        <p className="flex items-center gap-2">
          <MapPin size={15} aria-hidden="true" />
          LizExpress Ltd, Kano, Nigeria
        </p>
        <p className="flex items-center gap-2">
          <Mail size={15} aria-hidden="true" />
          <a href="mailto:support@lizexpressltd.com" className="hover:text-purple-700">support@lizexpressltd.com</a>
        </p>
      </div>
      <Button as={Link} to="/register" size="lg">Join LizExpress</Button>
    </div>
  </div>
);

export default About;
