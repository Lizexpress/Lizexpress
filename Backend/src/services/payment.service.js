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
import { queueTemplate } from './email.service.js';
import { notify } from './notification.service.js';
import { adminClient } from '../lib/supabase.js';
import { sha512Hex, safeEqual } from '../lib/crypto.js';
import { BadRequest, NotFound, Forbidden, Conflict, ServiceUnavailable } from '../lib/errors.js';
import { PAYMENT_STATUS, ITEM_STATUS, NOTIFICATION_TYPE } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';

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

/** Server-to-server verification against Flutterwave. The only source of truth. */
const verifyWithFlutterwave = async (transactionId) => {
  const response = await fetch(`${env.flutterwave.baseUrl}/transactions/${transactionId}/verify`, {
    headers: {
      Authorization: `Bearer ${env.flutterwave.secretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    logger.error('flutterwave.verify.http_error', { status: response.status, transactionId });
    throw ServiceUnavailable('We could not reach the payment provider. Your card has not been charged twice.');
  }
  return response.json();
};

/**
 * Confirms a payment and publishes the item.
 * Idempotent — the callback and the webhook both land here and the second one
 * is a no-op, which matters because Flutterwave retries webhooks.
 */
const settle = async ({ payment, flwData }) => {
  if (payment.status === PAYMENT_STATUS.SUCCESSFUL) {
    return { alreadySettled: true, payment };
  }

  const amountMatches = Number(flwData.amount) >= Number(payment.amount);
  const currencyMatches = flwData.currency === payment.currency;
  const chargeSucceeded = flwData.status === 'successful';

  if (!chargeSucceeded || !amountMatches || !currencyMatches) {
    const failureReason = !chargeSucceeded
      ? flwData.processor_response || 'Charge was not successful'
      : 'Amount or currency mismatch';

    const updated = await paymentRepository.update(payment.id, {
      status: PAYMENT_STATUS.FAILED,
      failure_reason: failureReason,
      flutterwave_transaction_id: String(flwData.id ?? ''),
    });

    if (payment.item_id) await itemRepository.update(payment.item_id, { status: ITEM_STATUS.DRAFT });

    const { data: authUser } = await adminClient.auth.admin.getUserById(payment.user_id);
    if (authUser?.user?.email) {
      queueTemplate('paymentFailed', authUser.user.email, {
        name: payment.user?.full_name,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.tx_ref,
        reason: failureReason,
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

  let item = null;
  if (payment.item_id) {
    item = await itemRepository.update(payment.item_id, {
      payment_status: 'paid',
      status: ITEM_STATUS.ACTIVE,
      published_at: new Date().toISOString(),
    });
  }

  const { data: authUser } = await adminClient.auth.admin.getUserById(payment.user_id);
  const email = authUser?.user?.email;

  await notify({
    userId: payment.user_id,
    type: NOTIFICATION_TYPE.PAYMENT,
    title: 'Payment confirmed',
    content: item ? `"${item.name}" is now live on LizExpress.` : 'Your listing fee has been received.',
    actionUrl: item ? `/items/${item.id}` : '/dashboard',
    email: email
      ? {
          template: 'paymentReceipt',
          to: email,
          props: {
            name: payment.user?.full_name,
            amount: payment.amount,
            currency: payment.currency,
            reference: payment.tx_ref,
            itemName: item?.name ?? 'Listing fee',
            method: flwData.payment_type,
            paidAt: new Date().toISOString(),
          },
        }
      : undefined,
  });

  logger.info('payment.settled', { txRef: payment.tx_ref, amount: payment.amount });
  return { settled: true, payment: updated, item };
};

/** Called by the client after checkout closes. Verification still happens server-side. */
export const confirm = async ({ txRef: reference, transactionId, userId }) => {
  const payment = await paymentRepository.findByTxRef(reference);
  if (!payment) throw NotFound('We could not find that payment.');
  if (userId && payment.user_id !== userId) throw Forbidden('This payment does not belong to you.');

  const result = await verifyWithFlutterwave(transactionId);
  if (result.status !== 'success') {
    throw BadRequest('The payment provider could not confirm this transaction.');
  }

  // Guard against a spoofed transactionId pointing at someone else's charge.
  if (result.data.tx_ref !== reference) {
    logger.error('payment.txref_mismatch', { expected: reference, received: result.data.tx_ref });
    throw BadRequest('This transaction does not match the payment record.');
  }

  const outcome = await settle({ payment, flwData: result.data });
  return {
    status: outcome.settled || outcome.alreadySettled ? 'successful' : 'failed',
    txRef: reference,
    itemId: payment.item_id,
  };
};

/**
 * Webhook handler. Flutterwave signs each call with the hash configured in the
 * dashboard; an unsigned or mismatched call is dropped before any parsing.
 */
export const handleWebhook = async ({ signature, payload }) => {
  const expected = env.flutterwave.webhookHash;
  if (!expected || !signature || !safeEqual(signature, expected)) {
    logger.warn('webhook.rejected', { reason: 'signature mismatch' });
    throw Forbidden('Invalid webhook signature.');
  }

  const { event, data } = payload;
  if (!['charge.completed', 'transfer.completed'].includes(event)) {
    return { ignored: true, event };
  }

  const payment = await paymentRepository.findByTxRef(data.tx_ref);
  if (!payment) {
    logger.warn('webhook.unknown_txref', { txRef: data.tx_ref });
    return { ignored: true, reason: 'unknown tx_ref' };
  }

  const outcome = await settle({ payment, flwData: data });
  return { processed: true, settled: Boolean(outcome.settled || outcome.alreadySettled) };
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

export default { calculateFee, quote, initialise, confirm, handleWebhook, history, receipt };
