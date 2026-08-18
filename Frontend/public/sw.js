/**
 * Service worker — Web Push receiver.
 *
 * Deliberately no offline caching: a marketplace showing stale listings and
 * stale prices is worse than one that asks you to reconnect. This worker exists
 * only to deliver notifications while the app is closed.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'LizExpress', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'LizExpress', {
      body: payload.body ?? '',
      icon: payload.icon ?? '/android-chrome-192x192.png',
      badge: payload.badge ?? '/favicon-32x32.png',
      data: { url: payload.url ?? '/' },
      tag: payload.data?.chatId ? `chat-${payload.data.chatId}` : undefined,
      renotify: Boolean(payload.data?.chatId),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
