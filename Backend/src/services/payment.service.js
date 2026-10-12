/**
 * Listing fees via Flutterwave.
 *
 * v1 called Flutterwave's verify endpoint from the browser using a secret key
 * exposed through VITE_. That key was readable by anyone who opened devtools,
 * and the "payment successful" state was set by client code that a user could
 * simply call themselves.
 *
 * v2: the secret key exists only here, the amount is computed server-side from
 * the stored item value (never trusted from the request), and an item is only
 * published after Flutterwave confirms the charge to our own webhook.
 */
import paymentRepository from '../repositories/payment.repository.js';
import itemRepository from '../repositories/item.repository.js';
import userRepository from '../repositories/user.repository.js';
import { deliverTemplate } from './email.service.js';
import { notify } from './notification.service.js';
import { adminClient } from '../lib/supabase.js';
import { sha512Hex, safeEqual } from '../lib/crypto.js';
import { BadRequest, NotFound, Forbidden, Conflict, ServiceUnavailable } from '../lib/errors.js';
import { PAYMENT_STATUS, ITEM_STATUS, NOTIFICATION_TYPE } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';
import advertService from './advert.service.js';

const txRef = (userId) =>
  `LX-${Date.now()}-${userId.slice(0, 8)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

/** The fee is derived from the item's stored value. The client never supplies an amount. */
export const calculateFee = (itemValue) => {
  const value = Number(itemValue || 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw BadRequest('This item needs a valid estimated value before it can be published.');
  }
  const percentage = env.payment.listingFeePercentage;
  const fee = Math.max(Math.round((value * percentage) / 100), 100); // floor of ₦100 covers gateway cost
  return { fee, percentage, itemValue: value, currency: env.payment.currency };
};

export const quote = async ({ itemId, userId }) => {
  const item = await itemRepository.findById(itemId);
  if (!item) throw NotFound('Item not found.');
  if (item.user_id !== userId) throw Forbidden('This item does not belong to you.');
  if (item.payment_status === 'paid') throw Conflict('This listing has already been paid for.');

  const breakdown = calculateFee(item.estimated_cost);
  return { itemId, itemName: item.name, ...breakdown };
};

/**
 * Creates the pending payment record and returns everything the client needs to
 * open the Flutterwave checkout — including the PUBLIC key only.
 */
export const initialise = async ({ itemId, userId, email }) => {
  const item = await itemRepository.findById(itemId);
  if (!item) throw NotFound('Item not found.');
  if (item.user_id !== userId) throw Forbidden('This item does not belong to you.');
  if (item.payment_status === 'paid') throw Conflict('This listing has already been paid for.');

  const { fee, percentage, itemValue, currency } = calculateFee(item.estimated_cost);
  const profile = await userRepository.findById(userId, { full: true });
  const reference = txRef(userId);

  await paymentRepository.create({
    user_id: userId,
    item_id: itemId,
    tx_ref: reference,
    amount: fee,
    currency,
    status: PAYMENT_STATUS.PENDING,
    fee_percentage: percentage,
    item_value: itemValue,
  });

  await itemRepository.update(itemId, { status: ITEM_STATUS.PENDING_PAYMENT });

  logger.info('payment.initialised', { userId, itemId, reference, amount: fee });

  return {
    txRef: reference,
    amount: fee,
    currency,
    publicKey: env.flutterwave.publicKey,
    redirectUrl: `${env.appUrl}/payment/callback`,
    customer: { email, name: profile?.full_name ?? '', phone_number: profile?.phone ?? '' },
    customizations: {
      title: 'LizExpress Listing Fee',
      description: `${percentage}% listing fee for "${item.name}"`,
      logo: `${env.appUrl}/preview.png`,
    },
    meta: { itemId, userId },
  };
};

/**
 * Server-to-server lookups against Flutterwave — the only source of truth.
 *
 * A 4xx means "Flutterwave has no such transaction yet", which is normal for a
 * bank transfer in its first minutes: the customer is redirected back before
 * the transfer is registered. That returns null (try again later), never an
 * error. Only network failures and 5xx count as "unreachable".
 */
const flwGet = async (path, context) => {
  let response;
  try {
    response = await fetch(`${env.flutterwave.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${env.flutterwave.secretKey}`, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('flutterwave.unreachable', { ...context, error: error.message });
    throw ServiceUnavailable('We could not reach the payment provider. You have not been charged twice.');
  }
  if (response.status >= 500) {
    logger.error('flutterwave.http_error', { ...context, status: response.status });
    throw ServiceUnavailable('The payment provider is not responding. You have not been charged twice.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== 'success' || !body?.data) {
    logger.warn('flutterwave.not_found_yet', { ...context, status: response.status, message: body?.message });
    return null;
  }
  return body.data;
};

/** Finds the charge by Flutterwave's id, falling back to our own reference. */
const lookupCharge = async ({ reference, transactionId }) => {
  if (transactionId) {
    const byId = await flwGet(`/transactions/${encodeURIComponent(transactionId)}/verify`, { transactionId, reference });
    if (byId) return byId;
  }
  return flwGet(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, { reference });
};

const isAdvertPayment = (payment) => Boolean(payment.advert_id) && String(payment.purpose ?? '').startsWith('advert');

const emailOf = async (userId) => {
  try {
    const { data } = await adminClient.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
};

/**
 * Everything that should follow a successful charge. Idempotent: an item that
 * is already published is left alone, and the advert path recomputes from the
 * payment records. Runs again when a payment is "already settled", so a
 * request that died half-way (payment marked paid, listing not published) is
 * finished by the next callback, webhook retry or page refresh.
 */
const completeSuccessful = async ({ payment, method }) => {
  if (isAdvertPayment(payment)) {
    return { advert: await advertService.activateAfterPayment({ payment }) };
  }
  if (!payment.item_id) return {};

  const current = await itemRepository.findById(payment.item_id);
  if (!current) return {};
  if (current.payment_status === 'paid' && current.status !== ITEM_STATUS.PENDING_PAYMENT) return { item: current };

  const item = await itemRepository.update(payment.item_id, {
    payment_status: 'paid',
    status: ITEM_STATUS.ACTIVE,
    published_at: current.published_at ?? new Date().toISOString(),
  });

  const email = await emailOf(payment.user_id);
  await notify({
    userId: payment.user_id,
    type: NOTIFICATION_TYPE.PAYMENT,
    title: 'Payment confirmed',
    content: `"${item.name}" is now live on LizExpress.`,
    actionUrl: `/items/${item.id}`,
    email: email
      ? {
          always: true,
          template: 'paymentReceipt',
          to: email,
          props: {
            name: payment.user?.full_name,
            amount: payment.amount,
            currency: payment.currency,
            reference: payment.tx_ref,
            itemName: item.name,
            method: method ?? payment.payment_method,
            paidAt: payment.paid_at ?? new Date().toISOString(),
          },
        }
      : undefined,
  }).catch((error) => logger.warn('payment.notify_failed', { txRef: payment.tx_ref, error: error.message }));

  return { item };
};

/**
 * Confirms a payment and publishes what it paid for.
 * Idempotent — the callback and the webhook both land here, and Flutterwave
 * retries webhooks.
 */
const settle = async ({ payment, flwData }) => {
  if (payment.status === PAYMENT_STATUS.SUCCESSFUL) {
    const follow = await completeSuccessful({ payment });
    return { alreadySettled: true, payment, ...follow };
  }

  const amountMatches = Number(flwData.amount) >= Number(payment.amount);
  const currencyMatches = flwData.currency === payment.currency;
  const chargeSucceeded = flwData.status === 'successful';

  if (!chargeSucceeded || !amountMatches || !currencyMatches) {
    // Bank transfers report "pending" until the money lands; that is not a failure.
    if (flwData.status === 'pending') {
      return { settled: false, pending: true, payment };
    }

    const failureReason = !chargeSucceeded
      ? flwData.processor_response || 'Charge was not successful'
      : 'Amount or currency mismatch';

    const updated = await paymentRepository.update(payment.id, {
      status: PAYMENT_STATUS.FAILED,
      failure_reason: failureReason,
      flutterwave_transaction_id: String(flwData.id ?? ''),
    });

    if (payment.item_id) await itemRepository.update(payment.item_id, { status: ITEM_STATUS.DRAFT });
    if (isAdvertPayment(payment)) {
      await advertService.revertAfterFailedPayment({ payment }).catch(() => {});
    }

    const email = await emailOf(payment.user_id);
    if (email) {
      await deliverTemplate('paymentFailed', email, {
        name: payment.user?.full_name,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.tx_ref,
        reason: failureReason,
        isAdvert: isAdvertPayment(payment),
      });
    }

    logger.warn('payment.failed', { txRef: payment.tx_ref, failureReason });
    return { settled: false, payment: updated };
  }

  const updated = await paymentRepository.update(payment.id, {
    status: PAYMENT_STATUS.SUCCESSFUL,
    flutterwave_transaction_id: String(flwData.id),
    flutterwave_reference: flwData.flw_ref,
    payment_method: flwData.payment_type,
    paid_at: new Date().toISOString(),
  });

  const follow = await completeSuccessful({ payment: { ...payment, ...updated }, method: flwData.payment_type });
  logger.info('payment.settled', { txRef: payment.tx_ref, amount: payment.amount, purpose: payment.purpose ?? 'item_listing' });
  return { settled: true, payment: updated, ...follow };
};

/** Called by the client after checkout closes. Verification still happens server-side. */
export const confirm = async ({ txRef: reference, transactionId, userId }) => {
  const payment = await paymentRepository.findByTxRef(reference);
  if (!payment) throw NotFound('We could not find that payment.');
  if (userId && payment.user_id !== userId) throw Forbidden('This payment does not belong to you.');

  const base = {
    txRef: reference,
    itemId: payment.item_id,
    advertId: payment.advert_id ?? null,
    purpose: payment.purpose ?? (payment.advert_id ? 'advert_photos' : 'item_listing'),
  };

  // Already settled by the webhook or an earlier check.
  if (payment.status === PAYMENT_STATUS.SUCCESSFUL) {
    const outcome = await settle({ payment, flwData: {} });
    return { ...base, status: 'successful', advertStatus: outcome.advert?.status ?? null };
  }

  const charge = await lookupCharge({ reference, transactionId });
  // Not registered yet (bank transfers take a minute or two): the page waits.
  if (!charge) return { ...base, status: 'pending', advertStatus: null };

  // Guard against a spoofed transactionId pointing at someone else's charge.
  if (charge.tx_ref !== reference) {
    logger.error('payment.txref_mismatch', { expected: reference, received: charge.tx_ref });
    throw BadRequest('This transaction does not match the payment record.');
  }

  const outcome = await settle({ payment, flwData: charge });
  return {
    ...base,
    status: outcome.settled || outcome.alreadySettled ? 'successful' : outcome.pending ? 'pending' : 'failed',
    // Lets the success screen say "live now" or "appears shortly, after review".
    advertStatus: outcome.advert?.status ?? null,
  };
};

/**
 * Settles payments left "pending" because the customer closed the page before
 * a bank transfer registered and no webhook arrived. Checks each with
 * Flutterwave by reference. Runs when a customer opens their adverts or
 * payments, and when an admin opens the adverts or payments screens.
 */
let lastGlobalSync = 0;
export const syncPending = async ({ userId } = {}) => {
  if (!userId) {
    if (Date.now() - lastGlobalSync < 2 * 60_000) return 0;
    lastGlobalSync = Date.now();
  }
  try {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
    let query = adminClient
      .from('payments')
      .select('*')
      .eq('status', PAYMENT_STATUS.PENDING)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(userId ? 5 : 15);
    if (userId) query = query.eq('user_id', userId);
    const { data: rows } = await query;

    let settled = 0;
    for (const row of rows ?? []) {
      const charge = await lookupCharge({ reference: row.tx_ref, transactionId: row.flutterwave_transaction_id || null }).catch(() => null);
      if (!charge || charge.tx_ref !== row.tx_ref || charge.status === 'pending') continue;
      const payment = await paymentRepository.findById(row.id);
      const outcome = await settle({ payment, flwData: charge });
      if (outcome.settled) settled += 1;
    }
    if (settled) logger.info('payment.sync_pending', { settled });
    return settled;
  } catch (error) {
    logger.warn('payment.sync_pending.failed', { error: error.message });
    return 0;
  }
};

/**
 * Flutterwave sends two shapes depending on the dashboard's webhook version:
 *   v3:     { event: 'charge.completed', data: { id, tx_ref, status, ... } }
 *   legacy: { 'event.type': 'BANK_TRANSFER_TRANSACTION', id, txRef, status, ... }
 */
const readWebhook = (payload = {}) => {
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  return {
    event: payload.event ?? payload['event.type'] ?? data.event_type ?? null,
    txRef: data.tx_ref ?? data.txRef ?? payload.txRef ?? null,
    transactionId: data.id ?? payload.id ?? null,
  };
};

/**
 * Webhook handler.
 *
 * The payload is never trusted on its own: every event is re-checked with
 * Flutterwave's API using our secret key, and the reference must match one of
 * our payments. That makes the verif-hash header a second check rather than
 * the only one, so a missing or mismatched hash is logged instead of answered
 * with 403 — Flutterwave treats any non-200 as "your server is down" and
 * stops trusting the URL.
 */
export const handleWebhook = async ({ signature, payload }) => {
  const expected = env.flutterwave.webhookHash;
  const signed = Boolean(expected && signature && safeEqual(signature, expected));
  if (!signed) {
    logger.warn('webhook.unsigned', {
      reason: !expected ? 'FLUTTERWAVE_WEBHOOK_HASH is not set' : !signature ? 'no verif-hash header' : 'hash mismatch',
      detail: 'Processed anyway after verifying with Flutterwave. Set the same secret hash in Flutterwave and Vercel.',
    });
  }

  const { event, txRef, transactionId } = readWebhook(payload);
  // Payouts we send (transfer.completed) are not customer payments.
  if (event === 'transfer.completed') return { ignored: true, reason: 'payout event', event };
  if (!txRef) return { ignored: true, reason: 'no reference', event };

  const payment = await paymentRepository.findByTxRef(txRef);
  if (!payment) {
    logger.warn('webhook.unknown_txref', { txRef });
    return { ignored: true, reason: 'unknown tx_ref' };
  }

  const charge = await lookupCharge({ reference: txRef, transactionId });
  if (!charge) return { ignored: true, reason: 'provider could not confirm yet' };
  if (charge.tx_ref !== txRef) {
    logger.error('webhook.txref_mismatch', { expected: txRef, received: charge.tx_ref });
    return { ignored: true, reason: 'reference mismatch' };
  }

  const outcome = await settle({ payment, flwData: charge });
  return { processed: true, settled: Boolean(outcome.settled || outcome.alreadySettled), signed };
};

export const history = ({ userId, page, limit }) => paymentRepository.list({ userId, page, limit });

export const receipt = async ({ txRef: reference, userId }) => {
  const payment = await paymentRepository.findByTxRef(reference);
  if (!payment) throw NotFound('Payment not found.');
  if (payment.user_id !== userId) throw Forbidden('This payment does not belong to you.');
  return payment;
};

/** Webhook-driven signature check needs the raw body, so expose the hasher too. */
export const hashPayload = (raw) => sha512Hex(raw);

export default { calculateFee, quote, initialise, confirm, handleWebhook, history, receipt, syncPending };
