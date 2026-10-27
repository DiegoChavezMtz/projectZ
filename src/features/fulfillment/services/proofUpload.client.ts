import { createClient } from '@/lib/supabase/client';
import { AppError } from '@/utils/errors';
import { fulfillmentErrors } from '../content/es-MX';
import {
  JPEG_QUALITIES,
  PROOF_IMAGE_TARGET_BYTES,
  PROOF_MAX_BYTES,
  checkProofFile,
  isImageType,
  proofExtension,
  scaleToFit,
} from '../utils/proofFile';

const fail = (code: string, details?: unknown) =>
  new AppError(code, fulfillmentErrors[code] ?? fulfillmentErrors.unknown!, details);

/** Reduce una imagen a JPEG con lado mayor ≤ 2000 px y ≤ 2 MB. null si no se pudo leer o no cabe. */
async function compressImage(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const { width, height } = scaleToFit(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }
  context.fillStyle = '#fff'; // PNG con transparencia: fondo blanco al pasar a JPEG
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of JPEG_QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob && blob.size <= PROOF_IMAGE_TARGET_BYTES) return blob;
  }
  return null;
}

/**
 * Sube el comprobante a `payment-proofs/{targetId}/{uuid}.{ext}` (imágenes comprimidas; PDF tal cual).
 * Devuelve la ruta del archivo para registrarla con `submit_payment_proof`.
 */
export async function uploadProof(targetId: string, file: File): Promise<string> {
  const check = checkProofFile(file);
  if (check !== 'ok') throw fail(check);

  let body: Blob = file;
  let contentType = file.type;
  if (isImageType(file.type)) {
    const compressed = await compressImage(file);
    if (!compressed) throw fail('file_too_large');
    body = compressed;
    contentType = 'image/jpeg';
  } else if (file.size > PROOF_MAX_BYTES) {
    throw fail('file_too_large');
  }

  const path = `${targetId}/${crypto.randomUUID()}.${proofExtension(contentType)}`;
  const { error } = await createClient()
    .storage.from('payment-proofs')
    .upload(path, body, { contentType });
  if (error) throw fail('upload_failed', error);
  return path;
}
