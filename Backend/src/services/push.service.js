/**
 * Web Push (VAPID) — reaches users whose app or browser is closed, which a
 * WebSocket by definition cannot. The same subscription model works for the
 * mobile app via its service worker / FCM bridge.
 */
import webpush from 'web-push';
import env from '../config/env.js';
import { pushRepository } from '../repositories/notification.repository.js';
import logger from '../lib/logger.js';

const configured = Boolean(env.vapid.publicKey && env.vapid.privateKey);

if (configured) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
} else {
  logger.warn('push.disabled', { reason: 'VAPID keys not configured' });
}

export const getPublicKey = () => env.vapid.publicKey ?? null;

export const subscribe = async ({ userId, subscription, platform, deviceId, userAgent }) =>
  pushRepository.saveSubscription({
    userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    platform,
    deviceId,
    userAgent,
  });

export const unsubscribe = async ({ userId, endpoint }) => pushRepository.remove(endpoint, userId);

/**
 * Sends to every active device for a user.
 * 404/410 from the push service means the subscription is dead — we deactivate
 * it rather than retrying forever.
 */
export const sendToUser = async (userId, { title, body, url, icon, badge, data = {} }) => {
  if (!configured) return { sent: 0, skipped: true };

  const subscriptions = await pushRepository.listForUser(userId);
  if (!subscriptions.length) return { sent: 0 };

  const payload = JSON.stringify({
    title,
    body,
    url: url ?? env.appUrl,
    icon: icon ?? `${env.appUrl}/android-chrome-192x192.png`,
    badge: badge ?? `${env.appUrl}/favicon-32x32.png`,
    data,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      ),
    ),
  );

  let sent = 0;
  await Promise.all(
    results.map(async (result, index) => {
      if (result.status === 'fulfilled') {
        sent += 1;
        return;
      }
      const status = result.reason?.statusCode;
      if (status === 404 || status === 410) {
        await pushRepository.deactivate(subscriptions[index].endpoint);
      } else {
        logger.warn('push.send.failed', { userId, status });
      }
    }),
  );

  return { sent, total: subscriptions.length };
};

export default { getPublicKey, subscribe, unsubscribe, sendToUser };
