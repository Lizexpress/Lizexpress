/**
 * Supabase Realtime — loaded on demand, never on first paint.
 *
 * The client is ~215KB and is only ever needed once a signed-in user
 * subscribes to a channel. An anonymous visitor browsing listings should not
 * pay for it, so the SDK is behind a dynamic import and the module is fetched
 * the first time a channel is actually opened.
 *
 * All reads and writes still go through our API. This client exists purely for
 * the WebSocket, so business rules cannot be bypassed from devtools.
 */
let clientPromise = null;
let currentToken = null;

const getClient = () => {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      // Apply whatever token was current at the moment the SDK finished loading.
      if (currentToken) client.realtime.setAuth(currentToken);
      return client;
    });
  }
  return clientPromise;
};

/**
 * Records the access token for Realtime. Deliberately does NOT trigger the
 * import — signing in should not download the WebSocket client until something
 * actually subscribes.
 */
export const setRealtimeAuth = (accessToken) => {
  currentToken = accessToken ?? null;
  if (clientPromise && accessToken) {
    clientPromise.then((client) => client.realtime.setAuth(accessToken)).catch(() => {});
  }
};

/**
 * Opens one broadcast channel. Returns a cleanup function that is safe to call
 * before the SDK has finished loading.
 */
export const openChannel = (channelName, getHandlers) => {
  let channel = null;
  let cancelled = false;

  getClient()
    .then((client) => {
      if (cancelled) return;

      channel = client.channel(channelName, { config: { broadcast: { self: false } } });
      for (const event of Object.keys(getHandlers() ?? {})) {
        channel.on('broadcast', { event }, ({ payload }) => getHandlers()?.[event]?.(payload));
      }
      channel.subscribe();
    })
    .catch(() => {
      // Realtime is an enhancement. If it cannot load, the app still works —
      // data is fetched normally and counts refresh on navigation.
    });

  return () => {
    cancelled = true;
    if (!channel) return;
    clientPromise?.then((client) => client.removeChannel(channel)).catch(() => {});
  };
};

export const channels = {
  chat: (chatId) => `chat:${chatId}`,
  notifications: (userId) => `user:${userId}:notifications`,
  adminFeed: () => 'admin:feed',
};
