/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REALTIME TRANSPORT — read this before changing anything.
 *
 * You asked for WebSockets. Serverless functions cannot hold one: every invocation
 * is a short-lived Lambda that is frozen the moment the HTTP response is sent.
 * There is no process alive to keep a socket open, so `ws` / socket.io on Vercel
 * would appear to work in local dev and then silently fail in production.
 *
 * So we still use WebSockets — we just don't host them ourselves.
 * Supabase Realtime is a managed WebSocket server that is already part of the
 * stack you are paying for. The split is:
 *
 *   • Clients (web + mobile) hold ONE WebSocket to Supabase Realtime and
 *     subscribe to their own channels.
 *   • This API broadcasts events into those channels over HTTP. Fire, return,
 *     let the function die. No connection to maintain.
 *   • Web Push (VAPID) covers the case where the app is closed entirely —
 *     a WebSocket cannot deliver to a backgrounded phone.
 *
 * Net effect: live chat and live notifications, zero socket infrastructure to
 * operate, and it survives the serverless execution model instead of fighting it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { adminClient } from '../lib/supabase.js';
import { REALTIME_CHANNEL } from '../config/constants.js';
import logger from '../lib/logger.js';

/**
 * Broadcasts one event and tears the channel down immediately.
 * Never throws: a dropped realtime event must not fail the HTTP request that
 * produced it — the data is already committed and the client will see it on
 * next fetch regardless.
 */
const broadcast = async (channelName, event, payload) => {
  let channel;
  try {
    channel = adminClient.channel(channelName, { config: { broadcast: { ack: false, self: false } } });
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event, payload });
    logger.debug('realtime.sent', { channelName, event });
  } catch (error) {
    logger.warn('realtime.failed', { channelName, event, error: error.message });
  } finally {
    if (channel) await adminClient.removeChannel(channel).catch(() => {});
  }
};

export const realtime = {
  /** New message landed in a thread — both participants are subscribed. */
  messageCreated: (chatId, message) =>
    broadcast(REALTIME_CHANNEL.chatThread(chatId), 'message:new', message),

  messagesRead: (chatId, readerId) =>
    broadcast(REALTIME_CHANNEL.chatThread(chatId), 'message:read', { chatId, readerId }),

  typing: (chatId, userId, isTyping) =>
    broadcast(REALTIME_CHANNEL.chatThread(chatId), 'typing', { chatId, userId, isTyping }),

  /** Per-user bell/badge channel. */
  notification: (userId, notification) =>
    broadcast(REALTIME_CHANNEL.userNotifications(userId), 'notification:new', notification),

  unreadCount: (userId, counts) =>
    broadcast(REALTIME_CHANNEL.userNotifications(userId), 'unread:update', counts),

  /** Admin console live feed — new signups, submissions, payments. */
  adminEvent: (event, payload) => broadcast(REALTIME_CHANNEL.adminFeed(), event, payload),
};

export default realtime;
