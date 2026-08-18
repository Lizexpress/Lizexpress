import { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../lib/api.js';

/**
 * Web Push subscription management.
 *
 * Web Push is a browser standard — there is no third-party service and no cost.
 * The server signs each message with a VAPID keypair and hands it to the
 * browser vendor's push service (Google, Mozilla, Apple).
 *
 * Everything here degrades safely: if the browser lacks support, the user
 * declines, or no VAPID key is configured, the app still delivers notifications
 * in-app over Realtime and by email. Push is purely additive.
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

const isSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const usePush = ({ enabled = false } = {}) => {
  const [permission, setPermission] = useState(() => (isSupported() ? Notification.permission : 'unsupported'));
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !isSupported()) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => setIsSubscribed(false));
  }, [enabled]);

  const subscribe = useCallback(async () => {
    if (!isSupported()) return { ok: false, reason: 'unsupported' };
    setIsBusy(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return { ok: false, reason: 'denied' };

      const { publicKey } = await endpoints.notifications.pushPublicKey();
      if (!publicKey) return { ok: false, reason: 'not_configured' };

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await endpoints.notifications.subscribePush({
        subscription: subscription.toJSON(),
        platform: 'web',
      });

      setIsSubscribed(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'failed' };
    } finally {
      setIsBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!isSupported()) return;
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await endpoints.notifications.unsubscribePush(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    isSupported: isSupported(),
    permission,
    isSubscribed,
    isBusy,
    subscribe,
    unsubscribe,
  };
};
