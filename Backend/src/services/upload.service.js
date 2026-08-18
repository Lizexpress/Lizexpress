/**
 * Storage.
 *
 * Two buckets with different rules:
 *   public  — item photos, avatars. Served directly by CDN.
 *   private — KYC documents. No public URL exists; reviewers get 5-minute
 *             signed URLs and nothing else. This is the fix for v1, where
 *             identity documents sat behind guessable public paths.
 */
import { adminClient } from '../lib/supabase.js';
import { BadRequest } from '../lib/errors.js';
import env from '../config/env.js';
import crypto from 'node:crypto';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

const extensionFor = (mimetype) =>
  ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'application/pdf': 'pdf',
  })[mimetype] ?? 'bin';

const assertFile = (file, { allowed, maxBytes, label }) => {
  if (!file) throw BadRequest(`No ${label} was uploaded.`);
  if (!allowed.includes(file.mimetype)) {
    throw BadRequest(`${label} must be one of: ${allowed.map((type) => type.split('/')[1]).join(', ')}.`);
  }
  if (file.size > maxBytes) {
    throw BadRequest(`${label} must be smaller than ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }
};

const put = async (bucket, path, file) => {
  const { error } = await adminClient.storage
    .from(bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
};

/** Item photos and avatars — publicly readable. */
export const uploadImage = async ({ userId, file, folder = 'items' }) => {
  assertFile(file, { allowed: IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES, label: 'Image' });

  const path = `${folder}/${userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extensionFor(file.mimetype)}`;
  await put(env.supabase.bucket, path, file);

  const { data } = adminClient.storage.from(env.supabase.bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
};

/**
 * KYC documents — returns the storage PATH, not a URL.
 * Nothing outside the admin review endpoint can turn this into a viewable link.
 */
export const uploadDocument = async ({ userId, file, kind }) => {
  assertFile(file, { allowed: DOCUMENT_TYPES, maxBytes: MAX_DOCUMENT_BYTES, label: 'Document' });

  const path = `kyc/${userId}/${kind}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extensionFor(file.mimetype)}`;
  await put(env.supabase.bucket, path, file);
  return { path, kind };
};

export const removeFile = async (path) => {
  const { error } = await adminClient.storage.from(env.supabase.bucket).remove([path]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
  return { deleted: true };
};

export default { uploadImage, uploadDocument, removeFile };
