import { useState } from 'react';
import { FaTiktok, FaYoutube, FaFacebookF, FaInstagram } from 'react-icons/fa6';
import { Mail, Phone, MapPin } from 'lucide-react';
import { SmartLink as Link } from '../ui/SmartLink.jsx';
import { Logo } from './Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { endpoints } from '../../lib/api.js';

/**
 * Footer, carried over from v1 including the real social accounts.
 *
 * Brand marks come from react-icons/fa6, which ships the official glyphs.
 * v1 used a generic speech-bubble for TikTok because lucide has no TikTok
 * icon — that is exactly the kind of stand-in that makes a footer look
 * untrustworthy, so it now uses the real mark.
 */
const SOCIALS = [
  { name: 'TikTok', url: 'https://www.tiktok.com/@lizexpressltd', Icon: FaTiktok },
  { name: 'YouTube', url: 'https://youtube.com/@lizexpressltd', Icon: FaYoutube },
  { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61577030412249', Icon: FaFacebookF },
  { name: 'Instagram', url: 'https://www.instagram.com/lizexpressnig', Icon: FaInstagram },
];

const CATEGORIES = [
  ['Electronics', 'Electronics'],
  ['Furniture', 'Furniture'],
  ['Phones', 'Phones & Accessories'],
  ['Computer', 'Computer & Accessories'],
  ['Clothing', 'Fashion & Clothing'],
];

export const Footer = () => {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    // Routed through the feedback endpoint so signups are captured server-side
    // rather than being discarded in component state, as they were in v1.
    await endpoints.system
      .feedback({ type: 'question', message: `Newsletter signup: ${email.trim()}`, email: email.trim() })
      .catch(() => {});
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="mt-auto bg-purple-600 py-10 text-white">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <nav aria-label="Quick links">
            <h3 className="mb-4 font-display text-base font-semibold text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="transition-colors hover:text-orange-500">Home</Link></li>
              <li><Link to="/browse" className="transition-colors hover:text-orange-500">Browse</Link></li>
              {isAuthenticated && (
                <li><Link to="/dashboard" className="transition-colors hover:text-orange-500">Dashboard</Link></li>
              )}
              <li><Link to="/how-it-works" className="transition-colors hover:text-orange-500">How It Works</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-orange-500">Terms &amp; Conditions</Link></li>
              <li><Link to="/privacy" className="transition-colors hover:text-orange-500">Privacy Policy</Link></li>
              <li><Link to="/refund-policy" className="transition-colors hover:text-orange-500">Refund Policy</Link></li>
            </ul>
          </nav>

          <nav aria-label="Categories">
            <h3 className="mb-4 font-display text-base font-semibold text-white">Categories</h3>
            <ul className="space-y-2 text-sm">
              {CATEGORIES.map(([value, label]) => (
                <li key={value}>
                  <Link to={`/browse?category=${value}`} className="transition-colors hover:text-orange-500">
                    {label}
                  </Link>
                </li>
              ))}
              <li><Link to="/browse" className="transition-colors hover:text-orange-500">Others</Link></li>
            </ul>
          </nav>

          <div>
            <h3 className="mb-4 font-display text-base font-semibold text-white">Follow Us</h3>
            <div className="mb-6 flex flex-wrap gap-3">
              {SOCIALS.map(({ name, url, Icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={name}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-orange-500"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>

            <ul className="space-y-2 text-sm text-purple-100/85">
              <li>
                <a href="mailto:support@lizexpressltd.com" className="flex items-center gap-2 transition-colors hover:text-orange-500">
                  <Mail size={15} aria-hidden="true" />
                  support@lizexpressltd.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={15} aria-hidden="true" />
                <a href="tel:+2349010000000" className="transition-colors hover:text-orange-500">+234 901 000 0000</a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={15} aria-hidden="true" />
                Kano, Nigeria
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-display text-base font-semibold text-white">Stay Updated</h3>
            <p className="mb-3 text-sm text-purple-100/85">
              New listings and swap tips. No spam.
            </p>
            <form onSubmit={subscribe} className="space-y-2">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600"
              >
                Subscribe
              </button>
              {subscribed && (
                <p role="status" className="text-sm text-orange-500">Thanks — you're on the list.</p>
              )}
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
          <Logo variant="light" imgClassName="h-8" />
          <p className="text-center text-xs text-purple-200/70">
            © {new Date().getFullYear()} LizExpress Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
