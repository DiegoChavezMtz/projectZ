import { fitWithin } from '@/utils/image';

// Reglas de las imágenes de artículo (docs/spec/data-model.md): WebP, lado mayor 1600 px, ≤ 5 MB.
export const ITEM_IMAGE_MAX_SIDE = 1600;
export const ITEM_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // límite del bucket
export const ITEM_IMAGE_MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const ITEM_IMAGE_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ItemImageProblem = 'type' | 'size';

export function checkItemImageInput(file: { type: string; size: number }): ItemImageProblem | null {
  if (!(ITEM_IMAGE_INPUT_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > ITEM_IMAGE_MAX_INPUT_BYTES) return 'size';
  return null;
}

/** Dimensiones de salida: lado mayor ≤ 1600 px, sin agrandar. */
export const itemImageSize = (width: number, height: number) =>
  fitWithin(width, height, ITEM_IMAGE_MAX_SIDE);

/** Calidades WebP a intentar, de mayor a menor, hasta caber en el límite del bucket. */
export const WEBP_QUALITIES = [0.85, 0.75, 0.65, 0.5] as const;

/** Ruta en el bucket `item-images`: `{user_id}/{session_id}/{uuid}.webp`. */
export const itemImagePath = (userId: string, sessionId: string, id: string) =>
  `${userId}/${sessionId}/${id}.webp`;

/** URL pública de una imagen guardada en `item-images`. */
export const itemImageUrl = (supabaseUrl: string, path: string | null | undefined) =>
  path ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/item-images/${path}` : null;
