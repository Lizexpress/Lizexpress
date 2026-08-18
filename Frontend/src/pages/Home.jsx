import { Hero } from '../components/home/Hero.jsx';
import { SearchStrip } from '../components/home/SearchStrip.jsx';
import { ItemsShowcase } from '../components/home/ItemsShowcase.jsx';
import { Testimonials } from '../components/home/Testimonials.jsx';
import { CallToAction } from '../components/home/CallToAction.jsx';

/**
 * Landing page, composed in the same order as v1:
 * hero carousel → orange search strip → live items → testimonials → CTA.
 * Everything above the fold is public; nothing here requires an account.
 */
const Home = () => (
  <>
    <Hero />
    <SearchStrip />
    <ItemsShowcase />
    <Testimonials />
    <CallToAction />
  </>
);

export default Home;
