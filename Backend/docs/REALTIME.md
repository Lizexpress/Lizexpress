# Realtime & Push — how live chat and notifications actually work

## Why not a WebSocket server in this API

You asked for WebSockets. This document explains why the implementation looks
different from a `ws` server, and why the end result is still WebSockets.

Vercel Functions are serverless: the instance is **frozen the moment it returns
an HTTP response** and destroyed shortly after. There is no long-lived process,
so there is nothing to hold a socket open. A `ws` or `socket.io` server mounted
on this Express app would work perfectly in local development and then fail
silently in production — connections would establish, then die within seconds,
and messages would appear to vanish.

This is not a Vercel limitation specifically. It applies to every serverless
platform, so moving hosts would not fix it — the fix is architectural.

Rather than run a separate always-on server just to hold sockets, we use the
WebSocket server that is already part of the stack: **Supabase Realtime**.

## The split

```
┌─────────────┐   WebSocket (persistent)   ┌──────────────────┐
│  Web / iOS  │◄──────────────────────────►│ Supabase Realtime│
│   Android   │                            └──────────────────┘
└──────┬──────┘                                     ▲
       │                                            │ broadcast over HTTP
       │ HTTPS (request/response)                   │ (fire, return, die)
       ▼                                            │
┌──────────────────────────────────────────────────┴┐
│           LizExpress API (Vercel Function)         │
└────────────────────────────────────────────────────┘
```

* **Clients** hold exactly one WebSocket to Supabase Realtime and subscribe to
  the channels they care about.
* **The API** writes to the database, then broadcasts an event into the relevant
  channel over HTTP, then returns. It holds no connection.
* **Web Push (VAPID)** covers the case a WebSocket fundamentally cannot: the app
  is closed.

The database write always happens **before** the broadcast. If a broadcast fails,
nothing is lost — the client sees the data on its next fetch. Realtime is an
optimisation, never the source of truth.

## Channels

| Channel | Who subscribes | Events |
|---|---|---|
| `chat:{chatId}` | The two participants | `message:new`, `message:read`, `typing` |
| `user:{userId}:notifications` | That user, on every device | `notification:new`, `unread:update` |
| `admin:feed` | Staff, while the console is open | `verification:submitted`, `verification:claimed`, `verification:decided`, `task:created` |

## Client subscription

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Realtime authenticates as the end user, so RLS applies to the subscription.
await supabase.realtime.setAuth(accessToken);

// A chat thread
const thread = supabase
  .channel(`chat:${chatId}`)
  .on('broadcast', { event: 'message:new' }, ({ payload }) => appendMessage(payload))
  .on('broadcast', { event: 'message:read' }, ({ payload }) => markDelivered(payload))
  .on('broadcast', { event: 'typing' }, ({ payload }) => showTyping(payload))
  .subscribe();

// The user's own notification channel — keep this one open app-wide
const bell = supabase
  .channel(`user:${userId}:notifications`)
  .on('broadcast', { event: 'notification:new' }, ({ payload }) => pushToast(payload))
  .on('broadcast', { event: 'unread:update' }, ({ payload }) => setBadges(payload))
  .subscribe();

// Always tear down on unmount, or you leak channels on every navigation
supabase.removeChannel(thread);
```

## Typing indicators

`POST /chats/{id}/typing` persists nothing — it only emits. Debounce it on the
client (roughly 400ms trailing, and send `isTyping: false` after ~2s of
inactivity). Do not call it per keystroke.

## Web Push setup

1. Generate keys once: `npx web-push generate-vapid-keys`
2. Put them in `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
3. Client: `GET /notifications/push/public-key`, then `PushManager.subscribe()`,
   then `POST /notifications/push/subscribe` with the resulting subscription.
4. Service worker:

```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

Subscriptions that return 404 or 410 from the push service are deactivated
automatically — no cleanup job needed.

## Respecting user preferences

The fan-out in `notification.service.js` checks `users.notification_preferences`
before using the push or email transports. Keys may be a channel (`push`,
`email`) or channel-plus-type (`push_message`, `email_verification`). The
in-app row is always written regardless, so history stays complete.
