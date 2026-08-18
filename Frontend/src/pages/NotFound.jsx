import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { ArrowLeftRight } from 'lucide-react';

const NotFound = () => (
  <div className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
    <ArrowLeftRight size={44} className="text-purple-200" />
    <p className="mt-6 font-display text-6xl font-bold text-purple-600">404</p>
    <h1 className="mt-3 font-display text-2xl font-semibold">This page does not exist</h1>
    <p className="mt-2 max-w-sm text-ink-muted">
      The link may be broken, or the page may have moved.
    </p>
    <div className="mt-7 flex gap-3">
      <Button as={Link} to="/" variant="outline">Go home</Button>
      <Button as={Link} to="/browse">Browse items</Button>
    </div>
  </div>
);

export default NotFound;
