/**
 * One place that owns every lazy route loader.
 *
 * App.jsx builds its <Route> elements from these, and the prefetcher calls the
 * same functions. Because the loader identity is shared, a prefetch triggered
 * by hovering a link and the later navigation resolve to the *same* module
 * promise — the chunk is fetched once and the navigation is instant.
 */
export const loaders = {
  home: () => import('../pages/Home.jsx'),
  browse: () => import('../pages/Browse.jsx'),
  itemDetail: () => import('../pages/ItemDetail.jsx'),
  howItWorks: () => import('../pages/HowItWorks.jsx'),
  about: () => import('../pages/About.jsx'),
  contact: () => import('../pages/Contact.jsx'),
  legal: () => import('../pages/Legal.jsx'),
  publicProfile: () => import('../pages/PublicProfile.jsx'),
  notFound: () => import('../pages/NotFound.jsx'),

  register: () => import('../pages/auth/Register.jsx'),
  verifyEmail: () => import('../pages/auth/VerifyEmail.jsx'),
  login: () => import('../pages/auth/Login.jsx'),
  forgotPassword: () => import('../pages/auth/ForgotPassword.jsx'),
  resetPassword: () => import('../pages/auth/ResetPassword.jsx'),

  dashboard: () => import('../pages/dashboard/Dashboard.jsx'),
  myListings: () => import('../pages/dashboard/MyListings.jsx'),
  favorites: () => import('../pages/dashboard/Favorites.jsx'),
  payments: () => import('../pages/dashboard/Payments.jsx'),
  settings: () => import('../pages/dashboard/Settings.jsx'),
  verification: () => import('../pages/dashboard/Verification.jsx'),

  listItem: () => import('../pages/ListItem.jsx'),
  adverts: () => import('../pages/adverts/BrowseAdverts.jsx'),
  advertDetail: () => import('../pages/adverts/AdvertDetail.jsx'),
  myAdverts: () => import('../pages/adverts/MyAdverts.jsx'),
  advertEditor: () => import('../pages/adverts/AdvertEditor.jsx'),
  onboarding: () => import('../pages/onboarding/Onboarding.jsx'),
  paymentCallback: () => import('../pages/PaymentCallback.jsx'),
  chats: () => import('../pages/Chats.jsx'),
  chatThread: () => import('../pages/ChatThread.jsx'),
  notifications: () => import('../pages/Notifications.jsx'),

  adminLogin: () => import('../admin/pages/AdminLogin.jsx'),
  adminLayout: () => import('../admin/AdminLayout.jsx'),
  adminDashboard: () => import('../admin/pages/AdminDashboard.jsx'),
  adminVerifications: () => import('../admin/pages/AdminVerifications.jsx'),
  adminUsers: () => import('../admin/pages/AdminUsers.jsx'),
  adminItems: () => import('../admin/pages/AdminItems.jsx'),
  adminPayments: () => import('../admin/pages/AdminPayments.jsx'),
  adminTasks: () => import('../admin/pages/AdminTasks.jsx'),
  adminFeedback: () => import('../admin/pages/AdminFeedback.jsx'),
  adminAudit: () => import('../admin/pages/AdminAudit.jsx'),
  adminSettings: () => import('../admin/pages/AdminSettings.jsx'),
  adminAdverts: () => import('../admin/pages/AdminAdverts.jsx'),
};

/** Path pattern → loader. Order matters: first match wins. */
const ROUTE_PATTERNS = [
  ['/browse', loaders.browse],
  ['/adverts/:id', loaders.advertDetail],
  ['/adverts', loaders.adverts],
  ['/dashboard/adverts/new', loaders.advertEditor],
  ['/dashboard/adverts/:id', loaders.advertEditor],
  ['/dashboard/adverts', loaders.myAdverts],
  ['/onboarding', loaders.onboarding],
  ['/items/:id', loaders.itemDetail],
  ['/how-it-works', loaders.howItWorks],
  ['/about', loaders.about],
  ['/contact', loaders.contact],
  ['/feedback', loaders.contact],
  ['/terms', loaders.legal],
  ['/privacy', loaders.legal],
  ['/refund-policy', loaders.legal],
  ['/users/:id', loaders.publicProfile],
  ['/login', loaders.login],
  ['/register', loaders.register],
  ['/verify-email', loaders.verifyEmail],
  ['/forgot-password', loaders.forgotPassword],
  ['/reset-password', loaders.resetPassword],
  ['/dashboard/listings', loaders.myListings],
  ['/dashboard/favorites', loaders.favorites],
  ['/dashboard/payments', loaders.payments],
  ['/dashboard', loaders.dashboard],
  ['/settings', loaders.settings],
  ['/id-verification', loaders.verification],
  ['/list-item', loaders.listItem],
  ['/chats/:id', loaders.chatThread],
  ['/chats', loaders.chats],
  ['/notifications', loaders.notifications],
  ['/admin/login', loaders.adminLogin],
  ['/admin/verifications', loaders.adminVerifications],
  ['/admin/users', loaders.adminUsers],
  ['/admin/items', loaders.adminItems],
  ['/admin/payments', loaders.adminPayments],
  ['/admin/tasks', loaders.adminTasks],
  ['/admin/feedback', loaders.adminFeedback],
  ['/admin/audit-log', loaders.adminAudit],
  ['/admin/settings', loaders.adminSettings],
  ['/admin/adverts', loaders.adminAdverts],
  ['/admin', loaders.adminDashboard],
  ['/', loaders.home],
];

const segmentsMatch = (pattern, path) => {
  const p = pattern.split('/').filter(Boolean);
  const t = path.split('/').filter(Boolean);
  if (p.length !== t.length) return false;
  return p.every((seg, i) => seg.startsWith(':') || seg === t[i]);
};

const started = new Set();

/**
 * Warms the chunk for a path. Safe to call repeatedly — each loader runs at
 * most once, and a failure is swallowed because a prefetch miss must never
 * surface to the user (navigation will simply load it normally).
 */
export const prefetchRoute = (path) => {
  if (!path || started.has(path)) return;
  const entry = ROUTE_PATTERNS.find(([pattern]) => segmentsMatch(pattern, path.split('?')[0]));
  if (!entry) return;
  started.add(path);
  entry[1]().catch(() => started.delete(path));
};

/**
 * Warms the routes a visitor is most likely to open next, once the browser is
 * idle and the current page has finished its own work.
 */
export const prefetchLikelyRoutes = (isAuthenticated) => {
  const paths = isAuthenticated
    ? ['/browse', '/adverts', '/dashboard', '/chats']
    : ['/browse', '/adverts', '/login', '/register'];

  const run = () => paths.forEach(prefetchRoute);

  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
};
