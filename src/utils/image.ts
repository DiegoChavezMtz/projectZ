/** Dimensiones que caben en `max` por su lado mayor, conservando la proporción. No agranda. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new RangeError('Dimensiones inválidas');
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** URL pública de una imagen guardada en el bucket `item-images` (la usan el editor y el visor). */
export const itemImageUrl = (supabaseUrl: string, path: string | null | undefined) =>
  path ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/item-images/${path}` : null;
