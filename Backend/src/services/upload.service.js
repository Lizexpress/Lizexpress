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
import logger from '../lib/logger.js';

/**
 * Photo shrinking. Phones upload 3–8 MB photos; customers then downloaded the
 * full file just to see a card, which is why adverts loaded slowly. Every
 * photo is resized to at most 1600px and saved as a progressive JPEG (~150–400
 * KB). sharp is loaded lazily so a missing native build degrades to "store the
 * original" instead of breaking uploads.
 */
const OPTIMISED_SUFFIX = '.o.jpg';
let sharpModule;
const loadSharp = async () => {
  if (sharpModule === undefined) {
    try {
      sharpModule = (await import('sharp')).default;
    } catch (error) {
      logger.warn('upload.sharp_unavailable', { error: error.message });
      sharpModule = null;
    }
  }
  return sharpModule;
};

export const optimiseImage = async (buffer) => {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    return await sharp(buffer, { failOn: 'none' })
      .rotate() // respect the phone's orientation flag
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    logger.warn('upload.optimise_failed', { error: error.message });
    return null;
  }
};

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

  const optimised = await optimiseImage(file.buffer);
  if (optimised) file = { ...file, buffer: optimised, mimetype: 'image/jpeg', size: optimised.length };
  const stem = `${folder}/${userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const path = optimised ? `${stem}${OPTIMISED_SUFFIX}` : `${stem}.${extensionFor(file.mimetype)}`;
  // Photos go to the PUBLIC bucket. Writing them to the private KYC bucket gave
  // every new photo a public link that the bucket then refused — the broken
  // image on new adverts and listings.
  // Profile pictures live with the existing ones in the public avatars bucket.
  const bucket = String(folder).startsWith('avatar') ? env.supabase.avatarBucket : env.supabase.publicBucket;
  await put(bucket, path, file);

  const { data } = adminClient.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl, bucket, bytes: file.size };
};

/* ───────── Shrinking photos uploaded before optimisation existed ───────── */

const storageRef = (url) => {
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/.exec(String(url ?? ''));
  return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null;
};

const reencode = async ({ bucket, path }) => {
  const { data: blob, error } = await adminClient.storage.from(bucket).download(path);
  if (error || !blob) throw new Error(`download ${bucket}/${path}: ${error?.message ?? 'empty'}`);
  const optimised = await optimiseImage(Buffer.from(await blob.arrayBuffer()));
  if (!optimised) throw new Error('could not optimise');
  const target = path.replace(/\.[a-z0-9]+$/i, '') + OPTIMISED_SUFFIX;
  const { error: upErr } = await adminClient.storage
    .from(env.supabase.publicBucket)
    .upload(target, optimised, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
  if (upErr) throw new Error(`upload ${target}: ${upErr.message}`);
  const { data } = adminClient.storage.from(env.supabase.publicBucket).getPublicUrl(target);
  return { path: target, url: data.publicUrl, bytes: optimised.length };
};

/**
 * Re-encodes existing advert and listing photos, a batch at a time (each call
 * stays well inside the 30-second function limit). Originals are kept; only
 * the links change. Returns how many were done and whether more remain.
 */
export const optimiseExisting = async ({ budgetMs = 20_000 } = {}) => {
  if (!(await loadSharp())) throw new Error('Image optimisation is not available on this server.');
  const started = Date.now();
  let done = 0;
  let failed = 0;

  const { data: photos } = await adminClient
    .from('advert_photos')
    .select('id, url, storage_path')
    .not('storage_path', 'like', `%${OPTIMISED_SUFFIX}`)
    .limit(40);
  for (const photo of photos ?? []) {
    if (Date.now() - started > budgetMs) break;
    const ref = storageRef(photo.url) ?? { bucket: env.supabase.publicBucket, path: photo.storage_path };
    try {
      const out = await reencode(ref);
      await adminClient.from('advert_photos').update({ url: out.url, storage_path: out.path, bytes: out.bytes }).eq('id', photo.id);
      done += 1;
    } catch (error) {
      failed += 1;
      logger.warn('optimise.advert_photo_failed', { id: photo.id, error: error.message });
      // Mark as handled so one broken file never blocks the queue.
      await adminClient.from('advert_photos').update({ storage_path: `${photo.storage_path}#skip${OPTIMISED_SUFFIX}` }).eq('id', photo.id);
    }
  }

  const { data: items } = await adminClient.from('items').select('id, images').not('images', 'is', null).limit(2000);
  for (const item of items ?? []) {
    if (Date.now() - started > budgetMs) break;
    const images = Array.isArray(item.images) ? item.images : [];
    if (!images.some((url) => storageRef(url) && !String(url).includes(OPTIMISED_SUFFIX) && !String(url).includes('#skip'))) continue;
    const next = [];
    for (const url of images) {
      const ref = storageRef(url);
      if (!ref || String(url).includes(OPTIMISED_SUFFIX) || String(url).includes('#skip')) {
        next.push(url);
        continue;
      }
      try {
        next.push((await reencode(ref)).url);
        done += 1;
      } catch (error) {
        failed += 1;
        logger.warn('optimise.item_photo_failed', { id: item.id, error: error.message });
        next.push(`${url}#skip`);
      }
    }
    await adminClient.from('items').update({ images: next }).eq('id', item.id);
  }

  const timedOut = Date.now() - started > budgetMs;
  return { done, failed, more: timedOut || done + failed > 0 };
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

export const removeFile = async (path, bucket = env.supabase.bucket) => {
  const { error } = await adminClient.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
  return { deleted: true };
};

/** Deletes a photo wherever it lives (new uploads: public; older ones: private). */
export const removeImage = async (path) => {
  await adminClient.storage.from(env.supabase.publicBucket).remove([path]).catch(() => {});
  if (env.supabase.bucket !== env.supabase.publicBucket) {
    await adminClient.storage.from(env.supabase.bucket).remove([path]).catch(() => {});
  }
  return { deleted: true };
};

/**
 * Photos uploaded before the public bucket existed point at the private
 * bucket, where a public link is refused. Swap those for signed links (valid
 * for a day) so they display; new uploads never need this.
 */
const privatePrefix = () => `/storage/v1/object/public/${env.supabase.bucket}/`;

export const resolvePhotoUrls = async (photos = []) => {
  if (env.supabase.bucket === env.supabase.publicBucket) return photos;
  const stale = photos.filter((photo) => photo?.url?.includes(privatePrefix()));
  if (!stale.length) return photos;

  const { data, error } = await adminClient.storage
    .from(env.supabase.bucket)
    .createSignedUrls(stale.map((photo) => photo.storage_path), 60 * 60 * 24);
  if (error || !data) return photos;

  const signed = new Map(stale.map((photo, index) => [photo.id, data[index]?.signedUrl]));
  return photos.map((photo) => (signed.get(photo.id) ? { ...photo, url: signed.get(photo.id) } : photo));
};

export default {
  optimiseExisting, uploadImage, uploadDocument, removeFile, removeImage, resolvePhotoUrls };
