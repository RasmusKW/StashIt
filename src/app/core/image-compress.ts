/**
 * Photo compression on import: the longest side is scaled down to 1600 px and encoded as WebP
 * (JPEG where the browser cannot encode WebP) at quality 0.8, plus a 300 px thumbnail.
 */

export const MAX_PHOTO_SIDE = 1600;
export const THUMBNAIL_SIDE = 300;
export const PHOTO_QUALITY = 0.8;
export const THUMBNAIL_QUALITY = 0.75;

export interface CompressedPhoto {
  blob: Blob;
  thumbnail: Blob;
}

/** Scales (width, height) down so the longest side is at most `max`. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** File extension for a stored image type. */
export function extensionFor(type: string): string {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function encode(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Kunne ikke komprimere billedet'))),
      type,
      quality,
    ),
  );
}

/** Encodes as WebP, falling back to JPEG if the browser silently produced something else. */
async function encodeBest(canvas: AnyCanvas, quality: number): Promise<Blob> {
  const webp = await encode(canvas, 'image/webp', quality);
  if (webp.type === 'image/webp') return webp;
  return encode(canvas, 'image/jpeg', quality);
}

function draw(source: CanvasImageSource, width: number, height: number): AnyCanvas {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas er ikke tilgængelig');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** Compresses an image file picked by the user. Throws a Danish message on failure. */
export async function compressImage(file: Blob): Promise<CompressedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Billedformatet kan ikke læses af browseren');
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_SIDE);
    const full = draw(bitmap, size.width, size.height);
    const thumbSize = fitWithin(size.width, size.height, THUMBNAIL_SIDE);
    const thumb = draw(full, thumbSize.width, thumbSize.height);
    const [blob, thumbnail] = await Promise.all([
      encodeBest(full, PHOTO_QUALITY),
      encodeBest(thumb, THUMBNAIL_QUALITY),
    ]);
    return { blob, thumbnail };
  } finally {
    bitmap.close();
  }
}
