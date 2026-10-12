/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * Phone cameras produce 3–8 MB images. Sent as-is they are slow to upload on
 * mobile data, can exceed the server's 4.5 MB request limit, and every
 * customer then downloads the full file to see a thumbnail. Resizing to at
 * most 1600px and re-encoding typically gives 150–400 KB with no visible loss
 * on a phone or laptop screen.
 *
 * Anything that cannot be decoded here (HEIC on some browsers, odd formats)
 * is returned unchanged; the server shrinks it instead.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW = 400 * 1024;

const loadBitmap = async (file) => {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const compressImage = async (file) => {
  try {
    if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || file.size < SKIP_BELOW) return file;

    const source = await loadBitmap(file);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    source.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
};

export default compressImage;
