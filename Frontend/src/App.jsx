import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { RequireAuth, RequireVerified, RequireStaff, RequireOnboarded } from './routes/guards.jsx';
import { PageLoader } from './components/ui/Spinner.jsx';
import { loaders } from './routes/routeMap.js';

/**
 * Every route is code-split.
 *
 * The landing page is what most first-time visitors see, and it should not be
 * carrying the admin console, the chat client, and the charting library in its
 * bundle. Vite's manualChunks config keeps recharts out of the main bundle
 * entirely; these lazy boundaries keep the route code out too.
 */
const {
  home, browse, itemDetail, howItWorks, about, contact, legal, publicProfile, notFound,
  register, verifyEmail, login, forgotPassword, resetPassword,
  dashboard, myListings, favorites, payments, settings, verification,
  listItem, paymentCallback, chats, chatThread, notifications,
  adminLogin, adminLayout, adminDashboard, adminVerifications, adminUsers, adminItems,
  adminPayments, adminTasks, adminFeedback, adminAudit, adminSettings, adminAdverts,
  adverts, advertDetail, myAdverts, advertEditor, onboarding,
} = loaders;

const BrowseAdverts = lazy(adverts);
const AdvertDetail = lazy(advertDetail);
const MyAdverts = lazy(myAdverts);
const AdvertEditor = lazy(advertEditor);
const Onboarding = lazy(onboarding);
const AdminAdverts = lazy(adminAdverts);

const Home = lazy(home);
const Browse = lazy(browse);
const ItemDetail = lazy(itemDetail);
const HowItWorks = lazy(howItWorks);
const About = lazy(about);
const Contact = lazy(contact);
const Legal = lazy(legal);
const PublicProfile = lazy(publicProfile);
const NotFound = lazy(notFound);

const Register = lazy(register);
const VerifyEmail = lazy(verifyEmail);
const Login = lazy(login);
const ForgotPassword = lazy(forgotPassword);
const ResetPassword = lazy(resetPassword);

const Dashboard = lazy(dashboard);
const MyListings = lazy(myListings);
const Favorites = lazy(favorites);
const Payments = lazy(payments);
const Settings = lazy(settings);
const Verification = lazy(verification);

const ListItem = lazy(listItem);
const PaymentCallback = lazy(paymentCallback);
const Chats = lazy(chats);
const ChatThread = lazy(chatThread);
const Notifications = lazy(notifications);

const AdminLogin = lazy(adminLogin);
const AdminLayout = lazy(adminLayout);
const AdminDashboard = lazy(adminDashboard);
const AdminVerifications = lazy(adminVerifications);
const AdminUsers = lazy(adminUsers);
const AdminItems = lazy(adminItems);
const AdminPayments = lazy(adminPayments);
const AdminTasks = lazy(adminTasks);
const AdminFeedback = lazy(adminFeedback);
const AdminAudit = lazy(adminAudit);
const AdminSettings = lazy(adminSettings);

/**
 * Admin lives on its own host: admin.lizexpressltd.com.
 *
 *  • On the admin host, only the console is mounted. Anything else redirects to
 *    /admin, so the public site's routes are unreachable there.
 *  • On the public host in production, /admin/* bounces to the admin host.
 *  • On localhost both work, so development needs no DNS setup. Set
 *    VITE_FORCE_ADMIN=true to preview the admin-only tree locally.
 *
 * This is a routing boundary, not the security boundary — every admin endpoint
 * re-checks the caller's role on the server.
 */
const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST || 'admin.lizexpressltd.com';
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(host);
const isAdminHost =
  host === ADMIN_HOST || host.startsWith('admin.') || import.meta.env.VITE_FORCE_ADMIN === 'true';
const sendAdminAway = !isLocal && !isAdminHost;

const ToAdminHost = () => {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`https://${ADMIN_HOST}${location.pathname}${location.search}`);
  }, [location]);
  return <PageLoader />;
};

const adminRoutes = (
  <>
    {/* Staff sign-in sits OUTSIDE the guard — otherwise the guard would
        redirect to it and the redirect would hit the guard again. */}
    <Route path="/admin/login" element={<Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>} />

    <Route element={<RequireStaff />}>
      <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminLayout /></Suspense>}>
        <Route index element={<AdminDashboard />} />
        <Route path="verifications" element={<AdminVerifications />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="items" element={<AdminItems />} />
        <Route path="adverts" element={<AdminAdverts />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="audit-log" element={<AdminAudit />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Route>
  </>
);

const AdminApp = () => (
  <Routes>
    {adminRoutes}
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
);

const PublicApp = () => (
  <>
    {/* Keyboard users should be able to jump past the header on every page. */}
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-purple-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      Skip to content
    </a>

    <Routes>
      {/* Auth screens sit outside the app shell — no header, no nav, no distractions. */}
      <Route
        path="/register"
        element={<Suspense fallback={<PageLoader />}><Register /></Suspense>}
      />
      <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />

      {/* Onboarding sits outside the app shell, like the auth screens. */}
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
      </Route>

      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="items/:id" element={<ItemDetail />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="feedback" element={<Contact />} />
        <Route path="terms" element={<Legal />} />
        <Route path="privacy" element={<Legal />} />
        <Route path="refund-policy" element={<Legal />} />
        <Route path="users/:id" element={<PublicProfile />} />
        <Route path="adverts" element={<BrowseAdverts />} />
        <Route path="adverts/:id" element={<AdvertDetail />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireOnboarded />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dashboard/adverts" element={<MyAdverts />} />
            <Route path="dashboard/adverts/new" element={<AdvertEditor />} />
            <Route path="dashboard/adverts/:id" element={<AdvertEditor />} />
            <Route path="dashboard/listings" element={<MyListings />} />
            <Route path="dashboard/favorites" element={<Favorites />} />
            <Route path="dashboard/payments" element={<Payments />} />
            <Route path="settings" element={<Settings />} />
            <Route path="id-verification" element={<Verification />} />
            <Route path="chats" element={<Chats />} />
            <Route path="chats/:id" element={<ChatThread />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="payment/callback" element={<PaymentCallback />} />

            {/* Listing requires an approved identity — the guard redirects to KYC. */}
            <Route element={<RequireVerified />}>
              <Route path="list-item" element={<ListItem />} />
            </Route>
          </Route>
        </Route>
      </Route>

      {sendAdminAway
        ? <Route path="/admin/*" element={<ToAdminHost />} />
        : adminRoutes}

      <Route path="/404" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  </>
);

export const App = () => (isAdminHost ? <AdminApp /> : <PublicApp />);

export default App;
