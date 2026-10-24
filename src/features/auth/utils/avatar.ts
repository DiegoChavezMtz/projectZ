// Reglas del avatar (docs/spec/auth.md, A10): WebP de 512 px en el bucket público `avatars`.
export const AVATAR_SIZE = 512;
export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // límite del bucket
export const AVATAR_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarProblem = 'type' | 'size';

/** Valida el archivo que elige la persona (antes de redimensionar). */
export function checkAvatarInput(file: { type: string; size: number }): AvatarProblem | null {
  if (!(AVATAR_INPUT_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > AVATAR_MAX_INPUT_BYTES) return 'size';
  return null;
}

/** Recorte cuadrado centrado ("cover") de una imagen w×h. */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

/** URL pública de un avatar guardado como `<user_id>/<archivo>.webp`. */
export function avatarPublicUrl(supabaseUrl: string, path: string | null | undefined) {
  if (!path) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/avatars/${path}`;
}

/** Ruta válida del avatar de un usuario (la server action no confía en nombres del cliente). */
export const avatarPathFor = (userId: string, stamp: number) => `${userId}/${stamp}.webp`;
