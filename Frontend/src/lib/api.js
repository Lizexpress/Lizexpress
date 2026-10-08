/**
 * HTTP client for the LizExpress API.
 *
 * Responsibilities kept in one place so no screen has to think about them:
 *   • unwraps the { success, data, meta } envelope
 *   • turns error responses into a typed ApiError with usable field messages
 *   • refreshes an expired access token and replays the request, once
 *   • de-duplicates concurrent refreshes so a burst of 401s triggers one call
 *   • aborts in-flight requests on demand (used by search-as-you-type)
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const ACCESS_KEY = 'lx.accessToken';
const REFRESH_KEY = 'lx.refreshToken';

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Field-level messages keyed by field name, ready to drop into a form.
   * Returns {} when the error was not a validation failure.
   */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, issue) => {
      if (issue?.field) acc[issue.field] = issue.message;
      return acc;
    }, {});
  }
}

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Broadcast so the auth context can react to a session dying mid-session. */
const emitSessionExpired = () => window.dispatchEvent(new CustomEvent('lx:session-expired'));

let refreshPromise = null;

/**
 * Exchanges the refresh token for a new session.
 * Concurrent callers share one in-flight promise — otherwise five parallel
 * requests hitting 401 would fire five refreshes and invalidate each other.
 */
const refreshSession = async () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokens.refresh;
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) throw new Error('refresh failed');

      const { data } = await response.json();
      tokens.set(data);
      return data.accessToken;
    } catch {
      tokens.clear();
      emitSessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const buildUrl = (path, query) => {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

const request = async (path, { method = 'GET', body, query, signal, isRetry = false, raw = false } = {}) => {
  const headers = {};
  const accessToken = tokens.access;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });

  if (response.status === 204) return null;

  // One transparent retry after refreshing. `isRetry` stops an infinite loop.
  if (response.status === 401 && !isRetry && tokens.refresh) {
    const renewed = await refreshSession();
    if (renewed) return request(path, { method, body, query, signal, isRetry: true, raw });
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) emitSessionExpired();
    const error = json?.error ?? {};
    throw new ApiError(error.message ?? 'Something went wrong. Please try again.', {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  // `raw` returns the envelope so callers can read pagination meta.
  return raw ? json : json?.data;
};

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),

  /** Returns { data, meta } for paginated endpoints. */
  list: (path, query, options) => request(path, { ...options, method: 'GET', query, raw: true }),

  upload: (path, file, { field = 'file', query } = {}) => {
    const form = new FormData();
    form.append(field, file);
    return request(path, { method: 'POST', body: form, query });
  },
};

/* ── Endpoint map ──────────────────────────────────────────
   Every path the app calls, in one place. Screens import from
   here rather than writing string literals, so a route rename
   is a single edit.                                          */
export const endpoints = {
  auth: {
    register: (body) => api.post('/auth/register', body),
    verifyEmail: (body) => api.post('/auth/verify-email', body),
    resendCode: (body) => api.post('/auth/resend-code', body),
    login: (body) => api.post('/auth/login', body),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    forgotPassword: (body) => api.post('/auth/forgot-password', body),
    verifyResetCode: (body) => api.post('/auth/verify-reset-code', body),
    resetPassword: (body) => api.post('/auth/reset-password', body),
    changePassword: (body) => api.post('/auth/change-password', body),
    completeOnboarding: (body) => api.post('/auth/onboarding', body),
  },
  users: {
    me: () => api.get('/users/me'),
    update: (body) => api.patch('/users/me', body),
    preferences: (preferences) => api.patch('/users/me/preferences', { preferences }),
    dashboard: () => api.get('/users/me/dashboard'),
    public: (id) => api.get(`/users/${id}`),
  },
  items: {
    browse: (query, options) => api.list('/items', query, options),
    categories: () => api.get('/items/categories'),
    detail: (id) => api.get(`/items/${id}`),
    create: (body) => api.post('/items', body),
    update: (id, body) => api.patch(`/items/${id}`, body),
    remove: (id) => api.delete(`/items/${id}`),
    markSwapped: (id) => api.post(`/items/${id}/swapped`),
    favorite: (id) => api.post(`/items/${id}/favorite`),
    mine: (query) => api.list('/items/me/listings', query),
    favorites: (query) => api.list('/items/me/favorites', query),
    uploadImage: (file) => api.upload('/items/upload', file),
    uploadAvatar: (file) => api.upload('/items/upload', file, { query: { folder: 'avatar' } }),
  },
  adverts: {
    search: (query, options) => api.list('/adverts', query, options),
    detail: (id) => api.get(`/adverts/${id}`),
    states: () => api.get('/adverts/states'),
    lgas: (stateCode) => api.get('/adverts/lgas', { query: { stateCode } }),
    locations: () => api.get('/adverts/locations'),
    recordContact: (id) => api.post(`/adverts/${id}/contact`),
    mine: (query) => api.list('/adverts/mine', query),
    create: (body) => api.post('/adverts', body),
    update: (id, body) => api.patch(`/adverts/${id}`, body),
    remove: (id) => api.delete(`/adverts/${id}`),
    addPhoto: (id, file) => api.upload(`/adverts/${id}/photos`, file, { field: 'photo' }),
    removePhoto: (photoId) => api.delete(`/adverts/photos/${photoId}`),
    quote: (id) => api.get(`/adverts/${id}/quote`),
    checkout: (id) => api.post(`/adverts/${id}/checkout`),
  },
  chats: {
    list: (query) => api.list('/chats', query),
    start: (itemId) => api.post('/chats', { itemId }),
    detail: (id, query) => api.list(`/chats/${id}`, query),
    send: (id, body) => api.post(`/chats/${id}/messages`, body),
    typing: (id, isTyping) => api.post(`/chats/${id}/typing`, { isTyping }),
    markRead: (id) => api.post(`/chats/${id}/read`),
    archive: (id, archived) => api.patch(`/chats/${id}/archive`, { archived }),
    unreadCount: () => api.get('/chats/unread-count'),
  },
  verifications: {
    status: () => api.get('/verifications/me'),
    submit: (body) => api.post('/verifications', body),
    uploadDocument: (kind, file) => api.upload(`/verifications/documents/${kind}`, file),
  },
  payments: {
    quote: (itemId) => api.get(`/payments/quote/${itemId}`),
    initialise: (itemId) => api.post('/payments/initialise', { itemId }),
    confirm: (body) => api.post('/payments/confirm', body),
    history: (query) => api.list('/payments/history', query),
    receipt: (txRef) => api.get(`/payments/receipt/${txRef}`),
  },
  notifications: {
    list: (query) => api.list('/notifications', query),
    unreadCount: () => api.get('/notifications/unread-count'),
    markRead: (id) => api.post(`/notifications/${id}/read`),
    markAllRead: () => api.post('/notifications/read-all'),
    remove: (id) => api.delete(`/notifications/${id}`),
    pushPublicKey: () => api.get('/notifications/push/public-key'),
    subscribePush: (body) => api.post('/notifications/push/subscribe', body),
    unsubscribePush: (endpoint) => api.post('/notifications/push/unsubscribe', { endpoint }),
  },
  system: {
    testimonials: () => api.get('/testimonials'),
    feedback: (body) => api.post('/feedback', body),
  },
  admin: {
    overview: () => api.get('/admin/overview'),
    timeseries: (days) => api.get('/admin/timeseries', { query: { days } }),
    analytics: () => api.get('/admin/analytics'),
    health: () => api.get('/admin/health'),
    verifications: (query) => api.list('/admin/verifications', query),
    verificationStats: () => api.get('/admin/verifications/stats'),
    verification: (id) => api.get(`/admin/verifications/${id}`),
    claimVerification: (id) => api.post(`/admin/verifications/${id}/claim`),
    decideVerification: (id, body) => api.post(`/admin/verifications/${id}/decision`, body),
    requestResubmit: (id, notes) => api.post(`/admin/verifications/${id}/resubmit`, { notes }),
    users: (query) => api.list('/admin/users', query),
    user: (id) => api.get(`/admin/users/${id}`),
    suspendUser: (id, body) => api.patch(`/admin/users/${id}/suspension`, body),
    setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
    invite: (body) => api.post('/admin/users/invite', body),
    items: (query) => api.list('/admin/items', query),
    setItemStatus: (id, body) => api.patch(`/admin/items/${id}/status`, body),
    payments: (query) => api.list('/admin/payments', query),
    tasks: (query) => api.list('/admin/tasks', query),
    createTask: (body) => api.post('/admin/tasks', body),
    updateTask: (id, body) => api.patch(`/admin/tasks/${id}`, body),
    deleteTask: (id) => api.delete(`/admin/tasks/${id}`),
    settings: () => api.get('/admin/settings'),
    updateSetting: (key, value) => api.put('/admin/settings', { key, value }),
    feedback: (query) => api.list('/admin/feedback', query),
    updateFeedback: (id, body) => api.patch(`/admin/feedback/${id}`, body),
    auditLog: (query) => api.list('/admin/audit-log', query),
    adverts: (query) => api.list('/admin/adverts', query),
    advert: (id) => api.get(`/admin/adverts/${id}`),
    advertStats: () => api.get('/admin/adverts/stats'),
    setAdvertStatus: (id, body) => api.patch(`/admin/adverts/${id}/status`, body),
  },
};

export default api;
