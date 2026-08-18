import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';

/**
 * Numbered steps are used here because the content genuinely is a sequence —
 * you cannot message before verifying, or swap before listing. The numbers
 * carry real information rather than decorating the layout.
 */
const STEPS = [
  ['Create your account', 'Sign up with your email and confirm it with the 6-digit code we send you.'],
  ['Verify your identity', 'Upload a government ID and a selfie. Our team reviews every submission by hand, usually within 24 hours.'],
  ['List what you have', 'Add photos, describe the condition honestly, and say what you want in return. A 5% listing fee publishes it.'],
  ['Agree a swap', 'Interested members message you. Agree the terms in chat, meet somewhere public, and make the exchange.'],
];

const HowItWorks = () => (
  <div className="container-page py-12 lg:py-20">
    <header className="max-w-2xl">
      <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-purple-700">
        <ArrowLeftRight size={13} />
        How it works
      </p>
      <h1 className="text-title font-bold text-balance">Four steps from clutter to something you actually want</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        LizExpress is a barter marketplace. Nobody is selling — everybody is trading.
      </p>
    </header>

    <ol className="mt-14 space-y-10">
      {STEPS.map(([title, copy], index) => (
        <li key={title} className="flex gap-5 sm:gap-7">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-600 font-display text-lg font-bold text-white"
          >
            {index + 1}
          </span>
          <div className="pt-1.5">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <p className="mt-1.5 max-w-2xl leading-relaxed text-ink-soft">{copy}</p>
          </div>
        </li>
      ))}
    </ol>

    <div className="mt-16 rounded-2xl bg-canvas-warm p-8 text-center">
      <h2 className="font-display text-2xl font-semibold">Ready to start?</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Creating an account is free. You only pay when you publish a listing.
      </p>
      <Button as={Link} to="/register" size="lg" className="mt-6" iconRight={ArrowRight}>
        Create your account
      </Button>
    </div>
  </div>
);

export default HowItWorks;
