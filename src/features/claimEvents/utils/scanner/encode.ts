import { ITEM_IMAGE_MAX_BYTES, WEBP_QUALITIES, type ItemImageOutputType } from '../image';

/** Calidades JPEG de respaldo, de mayor a menor, hasta caber en el límite del bucket. */
export const JPEG_QUALITIES = [0.88, 0.8, 0.7, 0.55, 0.4] as const;

export type CanvasEncoder = (type: ItemImageOutputType, quality: number) => Promise<Blob | null>;

export type EncodeResult =
  | { ok: true; blob: Blob; type: ItemImageOutputType; webpSupported: boolean }
  | { ok: false; reason: 'too_large' | 'unsupported'; webpSupported: boolean };

/**
 * Codifica la salida: WebP si el navegador sabe, y JPEG si no. Safari/iOS no codifica WebP en canvas: cuando se
 * pide `image/webp` devuelve un PNG (el `type` del blob lo delata). En ese caso se pasa a JPEG, que el bucket
 * `item-images` también acepta. `too_large` = ningún intento cupo en 5 MB; `unsupported` = el navegador no
 * entregó ni WebP ni JPEG.
 */
export async function encodeWithFallback(encode: CanvasEncoder): Promise<EncodeResult> {
  let webpSupported = true;
  let sawTooLarge = false;
  for (const quality of WEBP_QUALITIES) {
    const blob = await encode('image/webp', quality);
    if (!blob) continue;
    if (blob.type !== 'image/webp') {
      webpSupported = false;
      break;
    }
    if (blob.size <= ITEM_IMAGE_MAX_BYTES) return { ok: true, blob, type: 'image/webp', webpSupported };
    sawTooLarge = true;
  }
  for (const quality of JPEG_QUALITIES) {
    const blob = await encode('image/jpeg', quality);
    if (!blob || blob.type !== 'image/jpeg') continue;
    if (blob.size <= ITEM_IMAGE_MAX_BYTES) return { ok: true, blob, type: 'image/jpeg', webpSupported };
    sawTooLarge = true;
  }
  return { ok: false, reason: sawTooLarge ? 'too_large' : 'unsupported', webpSupported };
}
