/**
 * KYC submission and admin review.
 *
 * This is the flow v1 never finished: documents were uploaded but no admin
 * could actually look at them. The gap was that document URLs pointed at a
 * public bucket path with no reviewer UI and no decision trail.
 *
 * v2 fixes it end to end:
 *   • documents go to a PRIVATE storage bucket
 *   • reviewers receive short-lived signed URLs, minted per request
 *   • every decision writes an audit row naming the reviewer
 *   • the applicant is emailed the outcome, with the reason when rejected
 */
import verificationRepository from '../repositories/verification.repository.js';
import userRepository from '../repositories/user.repository.js';
import { auditRepository } from '../repositories/admin.repository.js';
import { adminClient } from '../lib/supabase.js';
import { notify } from './notification.service.js';
import { sendTemplate } from './email.service.js';
import realtime from './realtime.service.js';
import { BadRequest, Conflict, NotFound } from '../lib/errors.js';
import { VERIFICATION_STATUS, NOTIFICATION_TYPE } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — long enough to review, short enough to be useless if leaked

const reference = () =>
  `LX-KYC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/**
 * Where a stored document actually lives.
 *
 * v1 saved identity documents in the "verification" bucket, sometimes as a full
 * URL; the new backend saves bare paths in the private KYC bucket. Reviewers
 * must be able to open both, or every applicant from before the upgrade shows
 * blank documents.
 */
const locateDocument = (value) => {
  if (!value) return null;
  const match = String(value).match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (match) return { candidates: [match[1]], path: decodeURIComponent(match[2]) };
  if (/^https?:\/\//.test(value)) return { external: value };
  // A bare path: new uploads first, then the v1 bucket.
  return { candidates: [...new Set([env.supabase.bucket, env.supabase.legacyKycBucket])], path: String(value).replace(/^\/+/, '') };
};

const signDocument = async (value) => {
  const located = locateDocument(value);
  if (!located) return null;
  if (located.external) return located.external;
  for (const bucket of located.candidates) {
    const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(located.path, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  logger.warn('kyc.sign_url.failed', { path: located.path, tried: located.candidates });
  return null;
};

/**
 * Replaces stored storage paths with signed URLs the reviewer's browser can load.
 * Called only on admin read paths — the raw paths never reach a normal user.
 */
const withSignedDocuments = async (verification) => {
  if (!verification) return verification;

  const documentFields = ['identity_document', 'identity_document_back', 'address_document', 'selfie_image'];
  const signed = {};

  await Promise.all(
    documentFields.map(async (field) => {
      signed[field] = await signDocument(verification[field]);
    }),
  );

  return { ...verification, documents: signed, documentsExpireInSeconds: SIGNED_URL_TTL_SECONDS };
};

/* ───────────────── Applicant side ───────────────── */

export const submit = async ({ userId, payload }) => {
  const existing = await verificationRepository.findLatestForUser(userId);

  if (existing?.status === VERIFICATION_STATUS.APPROVED) {
    throw Conflict('Your identity is already verified.');
  }
  if ([VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.UNDER_REVIEW].includes(existing?.status)) {
    throw Conflict('You already have a submission under review. We will email you when it is decided.');
  }

  const record = await verificationRepository.create({
    user_id: userId,
    reference: reference(),
    document_type: payload.documentType,
    document_number: payload.documentNumber,
    identity_document: payload.identityDocument,
    identity_document_back: payload.identityDocumentBack,
    address_document: payload.addressDocument,
    selfie_image: payload.selfieImage,
    status: VERIFICATION_STATUS.PENDING,
    submitted_at: new Date().toISOString(),
    attempt_count: (existing?.attempt_count ?? 0) + 1,
  });

  await userRepository.update(userId, { verification_submitted: true });

  const profile = await userRepository.findById(userId, { full: true });
  const { data: authUser } = await adminClient.auth.admin.getUserById(userId);

  await sendTemplate('verificationSubmitted', authUser.user.email, {
    name: profile.full_name,
    reference: record.reference,
  });

  // Wake up the admin console so the queue badge updates without a refresh.
  await realtime.adminEvent('verification:submitted', {
    id: record.id,
    reference: record.reference,
    userId,
    submittedAt: record.submitted_at,
  });

  logger.info('kyc.submitted', { userId, reference: record.reference });
  return { id: record.id, reference: record.reference, status: record.status, submittedAt: record.submitted_at };
};

export const myStatus = async (userId) => {
  const record = await verificationRepository.findLatestForUser(userId);
  if (!record) {
    return { status: 'not_submitted', canSubmit: true, attemptCount: 0 };
  }
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    submittedAt: record.submitted_at,
    reviewedAt: record.reviewed_at,
    rejectionReason: record.rejection_reason,
    reviewerNotes: record.status === VERIFICATION_STATUS.REJECTED ? record.reviewer_notes : null,
    attemptCount: record.attempt_count,
    canSubmit: [VERIFICATION_STATUS.REJECTED, VERIFICATION_STATUS.RESUBMIT].includes(record.status),
  };
};

/* ───────────────── Reviewer side ───────────────── */

export const queue = async (filters) => {
  const result = await verificationRepository.list(filters);
  // Queue list shows metadata only — signed URLs are minted when a reviewer opens one.
  return result;
};

export const detail = async (id) => {
  const record = await verificationRepository.findById(id);
  if (!record) throw NotFound('Verification submission not found.');
  return withSignedDocuments(record);
};

/** Claiming a submission stops two reviewers duplicating work. */
export const claim = async ({ id, reviewerId }) => {
  const record = await verificationRepository.findById(id);
  if (!record) throw NotFound('Verification submission not found.');
  if (record.status !== VERIFICATION_STATUS.PENDING) {
    throw Conflict(`This submission is already ${record.status.replace('_', ' ')}.`);
  }

  const updated = await verificationRepository.update(id, {
    status: VERIFICATION_STATUS.UNDER_REVIEW,
    reviewed_by: reviewerId,
  });
  await realtime.adminEvent('verification:claimed', { id, reviewerId });
  return withSignedDocuments(updated);
};

export const decide = async ({ id, reviewerId, decision, reason, notes, request }) => {
  const record = await verificationRepository.findById(id);
  if (!record) throw NotFound('Verification submission not found.');
  if ([VERIFICATION_STATUS.APPROVED, VERIFICATION_STATUS.REJECTED].includes(record.status)) {
    throw Conflict('A decision has already been recorded for this submission.');
  }
  if (decision === 'reject' && !reason) {
    throw BadRequest('A rejection reason is required so the applicant knows what to fix.');
  }

  const approved = decision === 'approve';
  const status = approved ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.REJECTED;

  const updated = await verificationRepository.update(id, {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
    rejection_reason: approved ? null : reason,
    reviewer_notes: notes ?? null,
  });

  await userRepository.update(record.user_id, {
    is_verified: approved,
    verification_submitted: !approved ? false : true,
  });

  const { data: authUser } = await adminClient.auth.admin.getUserById(record.user_id);
  const email = authUser?.user?.email;
  const name = record.user?.full_name;

  await notify({
    userId: record.user_id,
    type: NOTIFICATION_TYPE.VERIFICATION,
    title: approved ? 'Your identity is verified' : 'Verification needs attention',
    content: approved
      ? 'You can now list items and message swappers.'
      : `We could not approve your documents: ${reason}`,
    actionUrl: approved ? '/list-item' : '/id-verification',
    email: email
      ? {
          template: approved ? 'verificationApproved' : 'verificationRejected',
          to: email,
          props: { name, reason, notes },
        }
      : undefined,
  });

  await auditRepository.record({
    actorId: reviewerId,
    action: approved ? 'verification.approved' : 'verification.rejected',
    entityType: 'verification',
    entityId: id,
    before: { status: record.status },
    after: { status, reason: reason ?? null },
    ipAddress: request?.ip,
    userAgent: request?.userAgent,
  });

  await realtime.adminEvent('verification:decided', { id, status, reviewerId });

  logger.info('kyc.decided', { id, status, reviewerId });
  return { id: updated.id, status: updated.status, reviewedAt: updated.reviewed_at };
};

/** Softer than a rejection — asks for one more document without failing the applicant. */
export const requestResubmission = async ({ id, reviewerId, notes, request }) => {
  const record = await verificationRepository.findById(id);
  if (!record) throw NotFound('Verification submission not found.');

  const updated = await verificationRepository.update(id, {
    status: VERIFICATION_STATUS.RESUBMIT,
    reviewed_by: reviewerId,
    reviewer_notes: notes,
  });

  await userRepository.update(record.user_id, { verification_submitted: false });

  const { data: authUser } = await adminClient.auth.admin.getUserById(record.user_id);
  await notify({
    userId: record.user_id,
    type: NOTIFICATION_TYPE.VERIFICATION,
    title: 'We need one more thing',
    content: notes,
    actionUrl: '/id-verification',
    email: authUser?.user?.email
      ? {
          template: 'verificationRejected',
          to: authUser.user.email,
          props: { name: record.user?.full_name, reason: 'Additional documentation required', notes },
        }
      : undefined,
  });

  await auditRepository.record({
    actorId: reviewerId,
    action: 'verification.resubmit_requested',
    entityType: 'verification',
    entityId: id,
    after: { notes },
    ipAddress: request?.ip,
  });

  return { id: updated.id, status: updated.status };
};

export const stats = async () => {
  const counts = await verificationRepository.counts();
  const oldest = await verificationRepository.oldestPending();
  const waitingHours = oldest
    ? Math.floor((Date.now() - new Date(oldest.submitted_at).getTime()) / 3_600_000)
    : 0;
  return { ...counts, oldestWaitingHours: waitingHours };
};

export default { submit, myStatus, queue, detail, claim, decide, requestResubmission, stats };
