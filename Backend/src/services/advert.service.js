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
import { deliverTemplate } from './email.service.js';
import { adminClient } from '../lib/supabase.js';
import { BadRequest, NotFound, Forbidden, Conflict, ServiceUnavailable } from '../lib/errors.js';
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

/** Ended after its paid month: renewing bills every photo again. */
const isRenewal = (advert) =>
  Number(advert.amount_paid_kobo ?? 0) > 0 &&
  Boolean(advert.published_at) &&
  (['expired', 'archived'].includes(advert.status) ||
    (advert.status === 'pending_payment' && advert.expires_at && new Date(advert.expires_at) < new Date()));

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

  // An ended advert is renewed by paying for all its photos again (another
  // month). A new or unfinished one pays only for photos not yet paid for.
  const renewal = isRenewal(advert);
  const billable = renewal
    ? await advertRepository.photosForBilling(advertId)
    : await advertRepository.unpaidPhotos(advertId);
  const unitKobo = await setting('advert_photo_price_kobo');
  const totalKobo = billable.reduce((sum, photo) => sum + Number(photo.price_kobo ?? unitKobo), 0);

  return {
    advertId,
    renewal,
    photoCount: advert.photo_count,
    billablePhotos: billable.length,
    unitPriceKobo: unitKobo,
    unitPrice: naira(unitKobo),
    totalKobo,
    total: naira(totalKobo),
    currency: env.payment.currency,
    durationDays: await setting('advert_duration_days'),
    // Tells the editor whether to promise "live now" or "after a quick check".
    autoApprove: await autoApprove(),
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
    throw Conflict(
      advert.status === 'active'
        ? 'This advert is live. You can renew it once its month ends.'
        : 'Every photo on this advertisement is already paid for.',
    );
  }

  const profile = await userRepository.findById(userId, { full: true });
  const reference = txRef(userId);

  /**
   * If the payments table refuses the row, say WHICH rule refused it. The
   * generic "something went wrong" hid a missing migration for a whole day.
   * Only the column/rule name is exposed, never data.
   */
  const createPayment = (payload) =>
    paymentRepository.create(payload).catch((error) => {
      const column = /column "([^"]+)"/.exec(error.message)?.[1];
      const rule = /constraint "([^"]+)"/.exec(error.message)?.[1];
      logger.error('advert.checkout.payment_rejected', { advertId, code: error.code, message: error.message });
      throw ServiceUnavailable('Payments are not available right now. Please try again shortly.', {
        reason: 'payments_table_rejected_row',
        dbCode: error.code ?? null,
        ...(column ? { column } : {}),
        ...(rule ? { rule } : {}),
        fix: 'Run migrations 0005 and 0006 in Supabase.',
      });
    });

  await createPayment({
    user_id: userId,
    advert_id: advertId,
    tx_ref: reference,
    amount: pricing.total,
    currency: pricing.currency,
    status: PAYMENT_STATUS.PENDING,
    purpose: pricing.renewal ? 'advert_renewal' : 'advert_photos',
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
      title: pricing.renewal ? 'Renew your LizExpress advert' : 'LizExpress Advertisement',
      description: `${pricing.billablePhotos} photo${pricing.billablePhotos === 1 ? '' : 's'} × ₦${pricing.unitPrice.toLocaleString()}`,
      logo: `${env.appUrl}/preview.png`,
    },
    meta: { advertId, userId, purpose: pricing.renewal ? 'advert_renewal' : 'advert_photos' },
  };
};

/* ───────────────────────── After payment ─────────────────────────
 *
 * The flow, end to end:
 *   draft → (checkout) pending_payment → (paid) pending_review → (admin approves) active
 * With advert_auto_approve on, "paid" goes straight to active.
 *
 * Applying a payment is idempotent and recomputed from the payments table
 * rather than incremented, so the callback, the webhook, a retry, or the admin
 * screen's self-repair can all run it and the result is the same. An earlier
 * version incremented a counter after marking the payment successful; when
 * that step failed, the payment showed "Paid" but the advert never moved.
 */

const autoApprove = async () => {
  const value = await setting('advert_auto_approve');
  return value === true || value === 'true';
};

const kobo = (naira) => Math.round(Number(naira || 0) * 100);

/** Missing column / enum value → the update is retried in a form older databases accept. */
const isSchemaLag = (error) =>
  ['PGRST204', '22P02', '42703'].includes(error?.code) || /paid_at|pending_review|invalid input value/i.test(error?.message ?? '');

const updateTolerant = async (advertId, payload) => {
  try {
    return await advertRepository.update(advertId, payload);
  } catch (error) {
    if (!isSchemaLag(error) && !isSchemaLag(error?.cause)) throw error;
    logger.warn('advert.update.schema_lag', { advertId, detail: 'Run migration 0007 for the review step.' });
    const { paid_at: _paidAt, ...rest } = payload;
    if (rest.status === 'pending_review') {
      // Without 0007 there is no review status: publish, as before.
      const days = await setting('advert_duration_days');
      Object.assign(rest, {
        status: 'active',
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      });
    }
    return advertRepository.update(advertId, rest);
  }
};

const safely = async (label, task) => {
  try {
    return await task();
  } catch (error) {
    logger.warn(label, { error: error.message });
    return null;
  }
};

const emailOf = async (userId) => {
  const { data } = await adminClient.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
};

/**
 * Brings one advert in line with its successful payments.
 * Returns { advert, changed, live } — `changed` is true only the first time a
 * given payment is applied, which is what keeps receipts from repeating.
 */
const applyPayments = async (advertId, knownPayments) => {
  const advert = await advertRepository.findById(advertId);
  if (!advert) return { advert: null, changed: false, live: false };

  const payments = knownPayments ?? (await paymentRepository.successfulForAdverts(advertId));
  const paidKobo = payments.reduce((sum, row) => sum + kobo(row.amount), 0);

  if (paidKobo <= Number(advert.amount_paid_kobo ?? 0)) {
    return { advert, changed: false, live: advert.status === 'active' };
  }

  const latest = payments[payments.length - 1];
  await advertRepository.markPhotosPaid(advert.id, latest?.id ?? null);

  const now = new Date();
  const payload = {
    amount_paid_kobo: paidKobo,
    amount_due_kobo: 0,
    paid_at: (latest?.paid_at ? new Date(latest.paid_at) : now).toISOString(),
  };

  const stillLive = advert.status === 'active' && (!advert.expires_at || new Date(advert.expires_at) > now);
  const days = await setting('advert_duration_days');
  // A renewal of an advert that was approved before goes straight back up for
  // another month. It was reviewed once; paying again is not a new review.
  const renewing = latest?.purpose === 'advert_renewal' && Boolean(advert.published_at) && advert.status !== 'suspended';
  if (renewing) {
    const from = stillLive && advert.expires_at ? new Date(advert.expires_at) : now;
    Object.assign(payload, {
      status: 'active',
      expires_at: new Date(from.getTime() + days * 86_400_000).toISOString(),
    });
  } else if (stillLive || advert.status === 'suspended') {
    // A top-up on a live advert stays live; a suspended one stays with the admin.
  } else if (await autoApprove()) {
    Object.assign(payload, {
      status: 'active',
      published_at: now.toISOString(),
      expires_at: new Date(now.getTime() + days * 86_400_000).toISOString(),
    });
  } else {
    payload.status = 'pending_review';
  }

  const updated = await updateTolerant(advert.id, payload);
  logger.info('advert.payment_applied', { advertId: advert.id, paidKobo, status: updated.status });
  return { advert: updated, changed: true, live: updated.status === 'active', payment: latest };
};

/** Tell the advertiser (receipt) and, when a review is needed, the admins. */
const announcePayment = async ({ advert, payment, live }) => {
  const amount = Number(payment?.amount ?? 0);
  const currency = payment?.currency ?? env.payment.currency;
  const profile = await safely('advert.announce.profile', () => userRepository.findById(advert.user_id, { full: true }));
  const email = await safely('advert.announce.email_lookup', () => emailOf(advert.user_id));
  const durationDays = await setting('advert_duration_days');

  await safely('advert.announce.notify', () =>
    notify({
      userId: advert.user_id,
      type: NOTIFICATION_TYPE.PAYMENT,
      title: live ? 'Your advert is live' : 'Payment received',
      content: live
        ? `"${advert.title}" is now visible to customers in ${advert.lga}, ${advert.state}.`
        : `We received your payment for "${advert.title}". It will appear on the adverts page shortly, after a quick check.`,
      actionUrl: live ? `/adverts/${advert.id}` : '/dashboard/adverts',
      email: email
        ? {
            always: true,
            template: 'advertPaymentReceipt',
            to: email,
            props: {
              name: profile?.full_name,
              amount,
              currency,
              reference: payment?.tx_ref,
              advertTitle: advert.title,
              businessName: advert.business_name,
              photoCount: payment?.photo_count ?? advert.photo_count,
              method: payment?.payment_method,
              paidAt: payment?.paid_at ?? new Date().toISOString(),
              live,
              durationDays,
            },
          }
        : undefined,
    }),
  );

  if (live) return;

  // Admin heads-up: in-app for everyone with access, email to the first few.
  const admins = await safely('advert.announce.admins', async () => {
    const { data } = await adminClient.from('users').select('id').in('role', ['admin', 'super_admin']).limit(10);
    return data ?? [];
  });
  await Promise.allSettled(
    (admins ?? []).map(async ({ id }) => {
      await notify({
        userId: id,
        type: NOTIFICATION_TYPE.SYSTEM,
        title: 'Advert waiting for approval',
        content: `"${advert.title}" by ${advert.business_name} has been paid for.`,
        actionUrl: `/admin/adverts?status=pending_review&open=${advert.id}`,
        pushEnabled: true,
      });
      const to = await emailOf(id);
      if (to) {
        await deliverTemplate('adminAdvertReview', to, {
          advertTitle: advert.title,
          businessName: advert.business_name,
          ownerName: profile?.full_name,
          amount,
          currency,
          location: [advert.lga, advert.state].filter(Boolean).join(', '),
          advertId: advert.id,
        });
      }
    }),
  );
};

/**
 * Called by payment.service whenever an advert payment is (or already was)
 * successful. Never throws: the money is taken, so the customer must see a
 * success screen; anything left over is picked up by `reconcile`.
 */
export const activateAfterPayment = async ({ payment }) => {
  try {
    const result = await applyPayments(payment.advert_id);
    if (!result.advert) {
      logger.error('advert.activate.missing', { paymentId: payment.id, advertId: payment.advert_id });
      return null;
    }
    if (result.changed) await announcePayment({ advert: result.advert, payment, live: result.live });
    return result.advert;
  } catch (error) {
    logger.error('advert.activate.failed', { paymentId: payment.id, advertId: payment.advert_id, error: error.message });
    return null;
  }
};

/**
 * Self-repair: finds adverts whose successful payments were never applied and
 * applies them (with the receipt the customer never got). Cheap — one query on
 * successful advert payments — and run when the admin adverts screen or the
 * advertiser's dashboard loads.
 */
export const reconcile = async ({ userId } = {}) => {
  try {
    const payments = (await paymentRepository.successfulForAdverts()).filter((row) => !userId || row.user_id === userId);
    if (!payments.length) return 0;

    const byAdvert = new Map();
    for (const row of payments) byAdvert.set(row.advert_id, [...(byAdvert.get(row.advert_id) ?? []), row]);

    const { data: adverts } = await adminClient
      .from('adverts')
      .select('id, amount_paid_kobo')
      .in('id', [...byAdvert.keys()]);

    let fixed = 0;
    for (const advert of adverts ?? []) {
      const rows = byAdvert.get(advert.id);
      const paid = rows.reduce((sum, row) => sum + kobo(row.amount), 0);
      if (paid <= Number(advert.amount_paid_kobo ?? 0)) continue;
      const latest = rows[rows.length - 1];
      const result = await applyPayments(advert.id, rows);
      if (result.changed) {
        fixed += 1;
        await announcePayment({ advert: result.advert, payment: latest, live: result.live });
      }
    }
    if (fixed) logger.info('advert.reconciled', { fixed });
    return fixed;
  } catch (error) {
    logger.warn('advert.reconcile.failed', { error: error.message });
    return 0;
  }
};

/** Charge failed or was abandoned: put the advert back where it was. */
export const revertAfterFailedPayment = async ({ payment }) => {
  const advert = await advertRepository.findById(payment.advert_id);
  if (!advert || advert.status !== 'pending_payment') return advert;

  let status = 'draft';
  if (Number(advert.amount_paid_kobo) > 0) {
    if (!advert.published_at) status = 'pending_review';
    else status = advert.expires_at && new Date(advert.expires_at) < new Date() ? 'expired' : 'active';
  }
  return updateTolerant(advert.id, { status });
};

/* ───────────────────────── Public reads ───────────────────────── */

export const search = async (filters) => {
  await expireLapsed();
  return withPhotosList(await advertRepository.search(filters));
};

export const detail = async ({ advertId, viewerId }) => {
  const advert = await advertRepository.findById(advertId);
  if (!advert) throw NotFound('Advertisement not found.');

  const isOwner = viewerId && advert.user_id === viewerId;
  const lapsed = advert.expires_at && new Date(advert.expires_at) < new Date();
  if ((advert.status !== 'active' || lapsed) && !isOwner) {
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

export const mine = async ({ userId, page, limit, status }) => {
  await reconcile({ userId });
  await expireLapsed();
  return withPhotosList(await advertRepository.listForUser({ userId, page, limit, status }));
};

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

  const paid = Number(advert.amount_paid_kobo ?? 0) > 0;
  if (status === 'active' && !paid) {
    throw Conflict('This advert has not been paid for, so it cannot go live.');
  }

  const now = new Date();
  const days = await setting('advert_duration_days');
  const lapsed = !advert.expires_at || new Date(advert.expires_at) < now;
  const approving = status === 'active' && (advert.status === 'pending_review' || !advert.published_at);

  // Approving starts the clock: the advertiser gets the full run from the day it
  // went live, not from the day they paid. Restoring a lapsed advert also moves
  // the end date, or the next expiry sweep would take it straight back down.
  const schedule =
    status === 'active' && (approving || lapsed)
      ? {
          ...(approving ? { published_at: now.toISOString() } : {}),
          expires_at: new Date(now.getTime() + days * 86_400_000).toISOString(),
        }
      : {};

  const updated = await advertRepository.update(advertId, {
    status,
    suspended_reason: status === 'suspended' ? (reason ?? null) : null,
    reviewed_by: actorId,
    ...schedule,
  });

  await auditRepository.record({
    actorId,
    action: approving ? 'advert.approved' : `advert.${status}`,
    entityType: 'advert',
    entityId: advertId,
    before: { status: advert.status },
    after: { status, reason: reason ?? null },
    ipAddress: request?.ip,
    userAgent: request?.userAgent,
  });

  const owner = await safely('advert.status.profile', () => userRepository.findById(advert.user_id, { full: true }));
  const email = await safely('advert.status.email_lookup', () => emailOf(advert.user_id));

  if (status === 'active') {
    await safely('advert.status.notify', () =>
      notify({
        userId: advert.user_id,
        type: NOTIFICATION_TYPE.SYSTEM,
        title: 'Your advert is live',
        content: `"${advert.title}" is now on the adverts page.`,
        actionUrl: `/adverts/${advertId}`,
        email: email
          ? {
              always: true,
              template: 'advertApproved',
              to: email,
              props: { name: owner?.full_name, advertTitle: advert.title, advertId, expiresAt: updated.expires_at },
            }
          : undefined,
      }),
    );
  }

  if (status === 'suspended') {
    const wasLive = advert.status === 'active';
    await safely('advert.status.notify', () =>
      notify({
        userId: advert.user_id,
        type: NOTIFICATION_TYPE.SYSTEM,
        title: wasLive ? 'Your advert was paused' : 'Your advert needs changes',
        content: reason ?? 'An administrator paused this advertisement. Contact support for details.',
        actionUrl: `/dashboard/adverts/${advertId}`,
        email: email
          ? {
              always: true,
              template: 'advertSuspended',
              to: email,
              props: { name: owner?.full_name, advertTitle: advert.title, advertId, reason, wasLive },
            }
          : undefined,
      }),
    );
  }

  logger.info('advert.admin_status', { advertId, status, actorId });
  return withPhotos(updated);
};

export const adminStats = async () => {
  await reconcile();
  await expireLapsed();
  const count = (status) => advertRepository.countBy('status', status).catch(() => 0);
  const [total, active, review, pending, suspended, expired] = await Promise.all([
    advertRepository.countAll(),
    count('active'),
    count('pending_review'),
    count('pending_payment'),
    count('suspended'),
    count('expired'),
  ]);
  return { total, active, review, pending, suspended, expired };
};

/**
 * Ends adverts whose month is up and tells each advertiser how to renew.
 * Idempotent: the update only matches rows still marked active, so two sweeps
 * running together email each advertiser once. Runs from the daily Vercel cron
 * and, at most every ten minutes, when adverts are browsed or managed.
 */
let lastSweep = 0;
export const expireLapsed = async ({ force = false } = {}) => {
  if (!force && Date.now() - lastSweep < 10 * 60_000) return 0;
  lastSweep = Date.now();
  try {
    const { data: lapsed } = await adminClient
      .from('adverts')
      .select('id, user_id, title, photo_count')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .limit(200);

    let ended = 0;
    for (const advert of lapsed ?? []) {
      const { data: changed } = await adminClient
        .from('adverts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', advert.id)
        .eq('status', 'active')
        .select('id');
      if (!changed?.length) continue;
      ended += 1;

      const [owner, email, unitKobo] = await Promise.all([
        safely('advert.expire.profile', () => userRepository.findById(advert.user_id, { full: true })),
        safely('advert.expire.email_lookup', () => emailOf(advert.user_id)),
        setting('advert_photo_price_kobo'),
      ]);
      await safely('advert.expire.notify', () =>
        notify({
          userId: advert.user_id,
          type: NOTIFICATION_TYPE.SYSTEM,
          title: 'Your advert has ended',
          content: `"${advert.title}" finished its month and is no longer shown. Renew it to put it back up.`,
          actionUrl: `/dashboard/adverts/${advert.id}?step=publish`,
          email: email
            ? {
                always: true,
                template: 'advertExpired',
                to: email,
                props: {
                  name: owner?.full_name,
                  advertTitle: advert.title,
                  advertId: advert.id,
                  renewAmount: naira(unitKobo * Math.max(1, Number(advert.photo_count) || 1)),
                },
              }
            : undefined,
        }),
      );
    }
    if (ended) logger.info('advert.expired', { ended });
    return ended;
  } catch (error) {
    logger.warn('advert.expire.failed', { error: error.message });
    return 0;
  }
};

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
  reconcile,
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
