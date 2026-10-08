import engagementRepository from '../repositories/engagement.repository.js';
import itemRepository from '../repositories/item.repository.js';
import { favoriteRepository } from '../repositories/admin.repository.js';
import { calculateFee } from './payment.service.js';
import { NotFound, Forbidden, BadRequest } from '../lib/errors.js';
import { ITEM_STATUS } from '../config/constants.js';

/**
 * Listings.
 * A new item is created as a DRAFT and only becomes visible after the listing
 * fee settles — publication is owned by the payment service, never by this one.
 */
export const create = async ({ userId, payload }) => {
  if (!payload.images?.length) {
    throw BadRequest('Add at least one photo — listings without photos rarely get offers.');
  }

  const item = await itemRepository.create({
    user_id: userId,
    name: payload.name,
    description: payload.description,
    category: payload.category,
    subcategory: payload.subcategory,
    condition: payload.condition,
    buying_price: payload.buyingPrice,
    estimated_cost: payload.estimatedCost,
    swap_for: payload.swapFor,
    location: payload.location,
    country: payload.country,
    state: payload.state,
    city: payload.city,
    images: payload.images,
    receipt_image: payload.receiptImage,
    status: ITEM_STATUS.DRAFT,
    payment_status: 'unpaid',
  });

  return { ...item, listingFee: calculateFee(item.estimated_cost) };
};

export const browse = (filters) => itemRepository.search(filters);

export const detail = async ({ id, viewerId }) => {
  const item = await itemRepository.findById(id);
  if (!item) throw NotFound('This item is no longer available.');

  const isOwner = viewerId && item.user_id === viewerId;
  if (item.status !== ITEM_STATUS.ACTIVE && !isOwner) {
    throw NotFound('This item is no longer available.');
  }

  // Owners viewing their own listing should not inflate their view count.
  if (!isOwner) await engagementRepository.record('item', id, 'view', viewerId ?? null).catch(() => {});

  return { ...item, isOwner: Boolean(isOwner) };
};

export const update = async ({ id, userId, payload }) => {
  const item = await itemRepository.findById(id);
  if (!item) throw NotFound('Item not found.');
  if (item.user_id !== userId) throw Forbidden('You can only edit your own listings.');
  if (item.status === ITEM_STATUS.SWAPPED) throw BadRequest('A completed swap cannot be edited.');

  return itemRepository.update(id, {
    name: payload.name,
    description: payload.description,
    category: payload.category,
    subcategory: payload.subcategory,
    condition: payload.condition,
    estimated_cost: payload.estimatedCost,
    swap_for: payload.swapFor,
    location: payload.location,
    country: payload.country,
    state: payload.state,
    city: payload.city,
    images: payload.images,
  });
};

export const remove = async ({ id, userId }) => {
  const item = await itemRepository.findById(id);
  if (!item) throw NotFound('Item not found.');
  if (item.user_id !== userId) throw Forbidden('You can only delete your own listings.');

  // Paid listings are archived, not destroyed — the payment record must keep its reference.
  if (item.payment_status === 'paid') {
    await itemRepository.update(id, { status: ITEM_STATUS.ARCHIVED });
    return { archived: true };
  }
  await itemRepository.remove(id);
  return { deleted: true };
};

export const markSwapped = async ({ id, userId }) => {
  const item = await itemRepository.findById(id);
  if (!item) throw NotFound('Item not found.');
  if (item.user_id !== userId) throw Forbidden('You can only update your own listings.');
  return itemRepository.update(id, { status: ITEM_STATUS.SWAPPED });
};

export const mine = ({ userId, page, limit, status }) =>
  itemRepository.search({ userId, page, limit, status });

export const toggleFavorite = ({ userId, itemId }) => favoriteRepository.toggle(userId, itemId);
export const favorites = ({ userId, page, limit }) => favoriteRepository.listForUser(userId, { page, limit });
export const categories = () => itemRepository.categoryBreakdown();

export default { create, browse, detail, update, remove, markSwapped, mine, toggleFavorite, favorites, categories };
