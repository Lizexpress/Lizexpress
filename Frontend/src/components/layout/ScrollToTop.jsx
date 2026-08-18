import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Restores the top of the page on navigation — routers do not do this by default. */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
