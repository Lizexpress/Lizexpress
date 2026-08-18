import userRepository from '../repositories/user.repository.js';
import itemRepository from '../repositories/item.repository.js';
import { messageRepository } from '../repositories/chat.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { favoriteRepository } from '../repositories/admin.repository.js';
import { NotFound } from '../lib/errors.js';
import { ITEM_STATUS } from '../config/constants.js';

export const profile = async (userId) => {
  const user = await userRepository.findById(userId, { full: true });
  if (!user) throw NotFound('Profile not found.');
  return user;
};

export const publicProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw NotFound('User not found.');
  const listings = await itemRepository.search({ userId, page: 1, limit: 12, status: ITEM_STATUS.ACTIVE });
  return { ...user, activeListings: listings.total, listings: listings.items };
};

export const updateProfile = async ({ userId, payload }) => {
  const updated = await userRepository.upsertProfile(userId, {
    full_name: payload.fullName,
    phone: payload.phone,
    avatar_url: payload.avatarUrl,
    residential_address: payload.residentialAddress,
    date_of_birth: payload.dateOfBirth,
    language: payload.language,
    gender: payload.gender,
    country: payload.country,
    state: payload.state,
    city: payload.city,
    zip_code: payload.zipCode,
    nationality: payload.nationality,
  });

  // Marks the onboarding step complete once the essentials are present.
  const complete = Boolean(updated.full_name && updated.country && updated.phone);
  if (complete !== updated.profile_completed) {
    return userRepository.update(userId, { profile_completed: complete });
  }
  return updated;
};

export const updatePreferences = ({ userId, preferences }) =>
  userRepository.update(userId, { notification_preferences: preferences });

/** Everything the dashboard header needs, in one round trip. */
export const dashboardSummary = async (userId) => {
  const [totalListings, activeListings, swapped, savedItems, unreadMessages, unreadNotifications] = await Promise.all([
    itemRepository.countBy({ user_id: userId }),
    itemRepository.countBy({ user_id: userId, status: ITEM_STATUS.ACTIVE }),
    itemRepository.countBy({ user_id: userId, status: ITEM_STATUS.SWAPPED }),
    favoriteRepository.countForUser(userId),
    messageRepository.unreadCount(userId),
    notificationRepository.unreadCount(userId),
  ]);

  return { totalListings, activeListings, swapped, savedItems, unreadMessages, unreadNotifications };
};

export default { profile, publicProfile, updateProfile, updatePreferences, dashboardSummary };
