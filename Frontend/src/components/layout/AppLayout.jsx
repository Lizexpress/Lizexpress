import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header.jsx';
import { Footer } from './Footer.jsx';
import { PageLoader } from '../ui/Spinner.jsx';
import { ScrollToTop } from './ScrollToTop.jsx';
import { prefetchLikelyRoutes } from '../../routes/routeMap.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const AppLayout = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, status } = useAuth();

  /**
   * Once the browser is idle, warm the routes this visitor is most likely to
   * open next. Waiting for idle means this never competes with the current
   * page's own rendering or data fetching.
   */
  useEffect(() => {
    if (status === 'loading') return;
    prefetchLikelyRoutes(isAuthenticated);
  }, [status, isAuthenticated]);
  // Chat threads manage their own scroll and need the full viewport height.
  const isChatThread = /^\/chats\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-app flex-col bg-canvas">
      <ScrollToTop />
      <Header />

      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {!isChatThread && <Footer />}
    </div>
  );
};

export default AppLayout;
