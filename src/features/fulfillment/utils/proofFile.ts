// Comprobantes: tipos y tamaños permitidos (bucket `payment-proofs`, 5 MB).
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
/** Las imágenes se comprimen en el cliente a este tope antes de subirse; los PDF van tal cual. */
export const PROOF_IMAGE_TARGET_BYTES = 2 * 1024 * 1024;
export const PROOF_MAX_SIDE = 2000;
export const PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const JPEG_QUALITIES = [0.85, 0.7, 0.55, 0.4];

export type ProofFileCheck = 'ok' | 'file_type' | 'file_too_large';

export function checkProofFile(file: { type: string; size: number }): ProofFileCheck {
  if (!IMAGE_TYPES.includes(file.type) && file.type !== 'application/pdf') return 'file_type';
  if (file.size > PROOF_MAX_BYTES * 4) return 'file_too_large'; // imágenes enormes ni se intentan comprimir
  if (file.type === 'application/pdf' && file.size > PROOF_MAX_BYTES) return 'file_too_large';
  return 'ok';
}

export const isImageType = (type: string) => IMAGE_TYPES.includes(type);

export function proofExtension(type: string): 'pdf' | 'jpg' {
  return type === 'application/pdf' ? 'pdf' : 'jpg';
}

/** Escala (ancho, alto) para que el lado mayor no pase de `max`. */
export function scaleToFit(width: number, height: number, max = PROOF_MAX_SIDE) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}
