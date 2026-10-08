/**
 * Advertising.
 *
 * A separate product line from swapping, sharing only infrastructure:
 *   • billing is PER PHOTO (₦1,000 each), not per listing or by item value
 *   • an advert is never swapped, so it carries no swap_for and opens no chat
 *   • it expires, where a swap listing sits until it is traded
 *
 * The price is read from platform_settings on every quote rather than from a
 * constant, so an admin can change it without a redeploy — and so a quote
 * issued before a price change is still honoured by the amount stored on the
 * advert, not recomputed at capture time.
 *
 * Money is handled in kobo throughout. The payments table stores naira, so the
 * conversion happens once, at the boundary, in `checkout`.
 */
import advertRepository, { locationRepository } from '../repositories/advert.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import userRepository from '../repositories/user.repository.js';
import { settingsRepository, auditRepository } from '../repositories/admin.repository.js';
import uploadService from './upload.service.js';
import { notify } from './notification.service.js';
import { queueTemplate } from './email.service.js';
import { BadRequest, NotFound, Forbidden, Conflict } from '../lib/errors.js';
import engagementRepository from '../repositories/engagement.repository.js';
import { PAYMENT_STATUS, NOTIFICATION_TYPE } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';

const DEFAULTS = {
  advert_photo_price_kobo: 100_000, // ₦1,000.00
  advert_duration_days: 30,
  advert_max_photos: 12,
  advert_min_photos: 1,
  advert_auto_approve: true,
};

const setting = async (key) => {
  try {
    const value = await settingsRepository.get(key, DEFAULTS[key]);
    // jsonb may round-trip numbers as strings depending on how they were written.
    return typeof DEFAULTS[key] === 'number' ? Number(value) || DEFAULTS[key] : value;
  } catch {
    return DEFAULTS[key];
  }
};

/** Older photos stored in the private bucket get signed links so they still display. */
const withPhotos = async (advert) =>
  advert ? { ...advert, photos: await uploadService.resolvePhotoUrls(advert.photos ?? []) } : advert;
const withPhotosList = async (result) => ({ ...result, items: await Promise.all((result.items ?? []).map(withPhotos)) });

const naira = (kobo) => Math.round(Number(kobo) / 100);

const txRef = (userId) =>
  `LXAD-${Date.now()}-${userId.slice(0, 8)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

const assertOwner = (advert, userId) => {
  if (!advert) throw NotFound('Advertisement not found.');
  if (advert.user_id !== userId) throw Forbidden('This advertisement does not belong to you.');
};

/* ───────────────────────── Create & edit ───────────────────────── */

export const create = async ({ userId, payload }) => {
  const profile = await userRepository.findById(userId, { full: true });

  // Advertising is opt-in at onboarding. Rather than reject, enrol them — a
  // user who has filled in an advert form has unambiguously opted in.
  const types = profile?.account_types ?? ['swapper'];
  if (!types.includes('advertiser')) {
    await userRepository.update(userId, { account_types: [...new Set([...types, 'advertiser'])] });
  }

  const advert = await advertRepository.create({
    user_id: userId,
    business_name: payload.businessName,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    subcategory: payload.subcategory,
    price_from: payload.priceFrom,
    price_to: payload.priceTo,
    price_note: payload.priceNote,
    contact_phone: payload.contactPhone,
    contact_whatsapp: payload.contactWhatsapp,
    contact_email: payload.contactEmail,
    website_url: payload.websiteUrl,
    country: payload.country ?? 'Nigeria',
    state: payload.state,
    state_code: payload.stateCode,
    lga: payload.lga,
    city: payload.city,
    address: payload.address,
    status: 'draft',
  });

  logger.info('advert.created', { advertId: advert.id, userId });
  return advert;
};

export const update = async ({ advertId, userId, payload }) => {
  const advert = await advertRepository.findById(advertId);
  assertOwner(advert, userId);

  if (['suspended'].includes(advert.status)) {
    throw Conflict('This advertisement is suspended and cannot be edited. Contact support.');
  }

  return withPhotos(await advertRepository.update(advertId, {
    business_name: payload.businessName,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    subcategory: payload.subcategory,
    price_from: payload.priceFrom,
    price_to: payload.priceTo,
    price_note: payload.priceNote,
    contact_phone: payload.contactPhone,
    contact_whatsapp: payload.contactWhatsapp,
    contact_email: payload.contactEmail,
    website_url: payload.websiteUrl,
    state: payload.state,
    state_code: payload.stateCode,
    lga: payload.lga,
    city: payload.city,
    address: payload.address,
  }));
};

export const remove = async ({ advertId, userId }) => {
  const advert = await advertRepository.findById(advertId);
  assertOwner(advert, userId);

  // Paid adverts are archived, never deleted — the payment record must keep
  // pointing at something for reconciliation and refunds.
  if (advert.amount_paid_kobo > 0) {
    await advertRepository.update(advertId, { status: 'archived' });
    return { archived: true };
  }
  return advertRepository.remove(advertId);
};

/* ───────────────────────── Photos ───────────────────────── */

export const addPhoto = async ({ advertId, userId, file, caption }) => {
  const advert = await advertRepository.findById(advertId);
  assertOwner(advert, userId);

  const max = await setting('advert_max_photos');
  if (advert.photo_count >= max) {
    throw BadRequest(`An advertisement can have at most ${max} photos.`);
  }
  if (advert.status === 'active') {
    throw Conflict('Pause or renew this advertisement before adding more photos.');
  }

  const { path, url } = await uploadService.uploadImage({ userId, file, folder: `adverts/${advertId}` });
  const priceKobo = await setting('advert_photo_price_kobo');

  const photo = await advertRepository.addPhoto({
    advert_id: advertId,
    storage_path: path,
    url,
    caption,
    position: advert.photo_count,
    bytes: file.size,
    price_kobo: priceKobo,
    is_paid: false,
  });

  logger.info('advert.photo_added', { advertId, photoId: photo.id });
  return photo;
};

export const removePhoto = async ({ photoId, userId }) => {
  const photo = await advertRepository.findPhoto(photoId);
  if (!photo) throw NotFound('Photo not found.');
  if (photo.advert?.user_id !== userId) throw Forbidden('This photo does not belong to you.');

  // A paid photo stays billed. Deleting it would let someone pay for three,
  // delete two, add two more and publish five for the price of three.
  if (photo.is_paid) {
    throw Conflict('This photo has already been paid for and cannot be removed. Archive the advert instead.');
  }

  await uploadService.removeImage(photo.storage_path).catch((error) =>
    logger.warn('advert.photo_file_orphaned', { photoId, error: error.message }),
  );
  return advertRepository.removePhoto(photoId);
};

/* ───────────────────────── Billing ───────────────────────── */

/**
 * What publishing this advert will cost right now.
 * Only unpaid photos are billed, so adding one photo to a live advert costs
 * ₦1,000 rather than re-charging for the whole set.
 */
export const quote = async ({ advertId, userId }) => {
  const advert = await advertRepository.findById(advertId);
  assertOwner(advert, userId);

  const unpaid = await advertRepository.unpaidPhotos(advertId);
  const unitKobo = await setting('advert_photo_price_kobo');
  const totalKobo = unpaid.reduce((sum, photo) => sum + Number(photo.price_kobo ?? unitKobo), 0);

  return {
    advertId,
    photoCount: advert.photo_count,
    billablePhotos: unpaid.length,
    unitPriceKobo: unitKobo,
    unitPrice: naira(unitKobo),
    totalKobo,
    total: naira(totalKobo),
    currency: env.payment.currency,
    durationDays: await setting('advert_duration_days'),
  };
};

/**
 * Opens checkout. Mirrors payment.service.initialise so the existing
 * Flutterwave client code, webhook and admin payments screen all work unchanged
 * — the only difference is purpose: 'advert_photos' and the advert_id link.
 */
export const checkout = async ({ advertId, userId, email }) => {
  const advert = await advertRepository.findById(advertId);
  assertOwner(advert, userId);

  const min = await setting('advert_min_photos');
  if (advert.photo_count < min) {
    throw BadRequest(`Add at least ${min} photo${min === 1 ? '' : 's'} before publishing.`);
  }

  const pricing = await quote({ advertId, userId });
  if (pricing.billablePhotos === 0) {
    throw Conflict('Every photo on this advertisement is already paid for.');
  }

  const profile = await userRepository.findById(userId, { full: true });
  const reference = txRef(userId);

  await paymentRepository.create({
    user_id: userId,
    advert_id: advertId,
    tx_ref: reference,
    amount: pricing.total,
    currency: pricing.currency,
    status: PAYMENT_STATUS.PENDING,
    purpose: 'advert_photos',
    photo_count: pricing.billablePhotos,
    // The payments table was built for item fees and may require these. An
    // advert has no item fee percentage; the "value" is what is being paid.
    fee_percentage: 0,
    item_value: pricing.total,
  });

  await advertRepository.update(advertId, {
    status: 'pending_payment',
    amount_due_kobo: pricing.totalKobo,
  });

  logger.info('advert.checkout', { advertId, userId, reference, amount: pricing.total });

  return {
    txRef: reference,
    amount: pricing.total,
    currency: pricing.currency,
    publicKey: env.flutterwave.publicKey,
    redirectUrl: `${env.appUrl}/payment/callback`,
    customer: { email, name: profile?.full_name ?? '', phone_number: profile?.phone ?? '' },
    customizations: {
      title: 'LizExpress Advertisement',
      description: `${pricing.billablePhotos} photo${pricing.billablePhotos === 1 ? '' : 's'} × ₦${pricing.unitPrice.toLocaleString()}`,
      logo: `${env.appUrl}/preview.png`,
    },
    meta: { advertId, userId, purpose: 'advert_photos' },
  };
};

/**
 * Called once Flutterwave confirms the charge.
 *
 * ── WIRE THIS UP ──
 * payment.service.js `confirm` and `handleWebhook` currently assume every
 * payment belongs to an item. Branch on the stored purpose:
 *
 *     if (payment.purpose === 'advert_photos') {
 *       await advertService.activateAfterPayment({ payment });
 *     } else {
 *       ...existing item publish path...
 *     }
 *
 * Doing it here rather than inside payment.service keeps the gateway code free
 * of product knowledge.
 */
export const activateAfterPayment = async ({ payment }) => {
  const advert = await advertRepository.findById(payment.advert_id);
  if (!advert) {
    logger.error('advert.activate.missing', { paymentId: payment.id, advertId: payment.advert_id });
    return null;
  }

  if (advert.status === 'active' && advert.amount_paid_kobo >= advert.amount_due_kobo) {
    return advert; // webhook and client callback both fired — idempotent
  }

  await advertRepository.markPhotosPaid(advert.id, payment.id);

  const days = await setting('advert_duration_days');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 86_400_000);

  const published = await advertRepository.update(advert.id, {
    status: 'active',
    published_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    amount_paid_kobo: (advert.amount_paid_kobo ?? 0) + Math.round(Number(payment.amount) * 100),
  });

  await notify({
    userId: advert.user_id,
    type: NOTIFICATION_TYPE.PAYMENT,
    title: 'Your advertisement is live',
    content: `"${advert.title}" is now visible to customers in ${advert.lga}, ${advert.state}.`,
    actionUrl: `/adverts/${advert.id}`,
  });

  logger.info('advert.activated', { advertId: advert.id, expiresAt });
  return published;
};

/** Charge failed or was abandoned — return the advert to draft so it can be retried. */
export const revertAfterFailedPayment = async ({ payment }) => {
  const advert = await advertRepository.findById(payment.advert_id);
  if (!advert || advert.status !== 'pending_payment') return advert;
  return advertRepository.update(advert.id, { status: advert.amount_paid_kobo > 0 ? 'active' : 'draft' });
};

/* ───────────────────────── Public reads ───────────────────────── */

export const search = async (filters) => withPhotosList(await advertRepository.search(filters));

export const detail = async ({ advertId, viewerId }) => {
  const advert = await advertRepository.findById(advertId);
  if (!advert) throw NotFound('Advertisement not found.');

  const isOwner = viewerId && advert.user_id === viewerId;
  if (advert.status !== 'active' && !isOwner) {
    throw NotFound('Advertisement not found.');
  }

  // Owners browsing their own advert should not inflate its view count.
  if (!isOwner) await engagementRepository.record('advert', advertId, 'view', viewerId ?? null).catch(() => {});

  return withPhotos(advert);
};

/** Fired when a customer reveals a phone number — the advertiser's ROI signal. */
export const recordContact = async ({ advertId, viewerId }) => {
  await engagementRepository.record('advert', advertId, 'contact', viewerId ?? null).catch(() => {});
  return { recorded: true };
};

export const mine = async ({ userId, page, limit, status }) =>
  withPhotosList(await advertRepository.listForUser({ userId, page, limit, status }));

export const locations = () => advertRepository.activeLocations();

export const states = () => locationRepository.states();
export const lgas = (stateCode) => locationRepository.lgas(stateCode);

/* ───────────────────────── Admin ───────────────────────── */

export const adminList = async (filters) => withPhotosList(await advertRepository.listForAdmin(filters));

export const adminDetail = async (advertId) => {
  const advert = await advertRepository.findById(advertId);
  if (!advert) throw NotFound('Advertisement not found.');
  return withPhotos(advert);
};

export const adminSetStatus = async ({ advertId, status, reason, actorId, request }) => {
  const advert = await advertRepository.findById(advertId);
  if (!advert) throw NotFound('Advertisement not found.');

  // Restoring a lapsed advert must also move its end date, or the next expiry
  // sweep would take it straight back down.
  const lapsed = advert.expires_at && new Date(advert.expires_at) < new Date();
  const extendTo =
    status === 'active' && lapsed
      ? new Date(Date.now() + (await setting('advert_duration_days')) * 86_400_000).toISOString()
      : undefined;

  const updated = await advertRepository.update(advertId, {
    status,
    suspended_reason: status === 'suspended' ? (reason ?? null) : null,
    reviewed_by: actorId,
    ...(extendTo ? { expires_at: extendTo } : {}),
  });

  await auditRepository.record({
    actorId,
    action: `advert.${status}`,
    entityType: 'advert',
    entityId: advertId,
    before: { status: advert.status },
    after: { status, reason: reason ?? null },
    ipAddress: request?.ip,
    userAgent: request?.userAgent,
  });

  if (status === 'suspended') {
    await notify({
      userId: advert.user_id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Your advertisement was paused',
      content: reason ?? 'An administrator paused this advertisement. Contact support for details.',
      actionUrl: `/dashboard/adverts/${advertId}`,
    });
  }

  logger.info('advert.admin_status', { advertId, status, actorId });
  return updated;
};

export const adminStats = async () => {
  const [total, active, pending, suspended, expired] = await Promise.all([
    advertRepository.countAll(),
    advertRepository.countBy('status', 'active'),
    advertRepository.countBy('status', 'pending_payment'),
    advertRepository.countBy('status', 'suspended'),
    advertRepository.countBy('status', 'expired'),
  ]);
  return { total, active, pending, suspended, expired };
};

/** Idempotent sweep — safe to run from a cron, a webhook or by hand. */
export const expireLapsed = () => advertRepository.expireLapsed();

export default {
  create,
  update,
  remove,
  addPhoto,
  removePhoto,
  quote,
  checkout,
  activateAfterPayment,
  revertAfterFailedPayment,
  search,
  detail,
  recordContact,
  mine,
  locations,
  states,
  lgas,
  adminList,
  adminDetail,
  adminSetStatus,
  adminStats,
  expireLapsed,
};
