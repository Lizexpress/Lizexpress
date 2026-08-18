/**
 * One entry point for "tell this user something".
 * Fans out to three transports and lets each fail independently:
 *   database row  → the bell menu and history
 *   realtime      → live badge update if the app is open
 *   web push      → if the app is closed
 *   email         → only for events worth an inbox interruption
 */
import { notificationRepository } from '../repositories/notification.repository.js';
import { messageRepository } from '../repositories/chat.repository.js';
import realtime from './realtime.service.js';
import push from './push.service.js';
import { queueTemplate } from './email.service.js';
import userRepository from '../repositories/user.repository.js';
import { NOTIFICATION_TYPE } from '../config/constants.js';
import logger from '../lib/logger.js';

/** Respects the per-user notification_preferences JSON column. */
const wants = (profile, channel, type) => {
  const prefs = profile?.notification_preferences ?? {};
  if (prefs[channel] === false) return false;
  if (prefs[`${channel}_${type}`] === false) return false;
  return true;
};

export const notify = async ({
  userId,
  type = NOTIFICATION_TYPE.SYSTEM,
  title,
  content,
  actionUrl,
  data = {},
  email,
  pushEnabled = true,
}) => {
  const notification = await notificationRepository.create({
    user_id: userId,
    type,
    title,
    content,
    data,
    action_url: actionUrl ?? null,
  });

  const profile = await userRepository.findById(userId, { full: true });

  // Everything below is best-effort; the row above is the source of truth.
  const tasks = [];

  tasks.push(realtime.notification(userId, notification));

  const [unreadNotifications, unreadMessages] = await Promise.all([
    notificationRepository.unreadCount(userId),
    messageRepository.unreadCount(userId),
  ]);
  tasks.push(realtime.unreadCount(userId, { notifications: unreadNotifications, messages: unreadMessages }));

  if (pushEnabled && wants(profile, 'push', type)) {
    tasks.push(
      push.sendToUser(userId, { title, body: content, url: actionUrl, data: { type, ...data } }),
    );
  }

  if (email?.template && wants(profile, 'email', type)) {
    queueTemplate(email.template, email.to, email.props ?? {});
  }

  await Promise.allSettled(tasks).catch((error) => logger.warn('notify.partial', { error: error.message }));

  return notification;
};

export const list = (userId, options) => notificationRepository.listForUser(userId, options);
export const unreadCount = (userId) => notificationRepository.unreadCount(userId);
export const markRead = (id, userId) => notificationRepository.markRead(id, userId);
export const markAllRead = (userId) => notificationRepository.markAllRead(userId);
export const remove = (id, userId) => notificationRepository.remove(id, userId);

export default { notify, list, unreadCount, markRead, markAllRead, remove };
