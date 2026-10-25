import { ITEM_IMAGE_MAX_BYTES, WEBP_QUALITIES, itemImageSize } from '../utils/image';

/**
 * Redimensiona (lado mayor ≤ 1600 px) y convierte a WebP en el navegador. Baja la calidad hasta que el
 * resultado cabe en el límite del bucket. Devuelve null si el archivo no se pudo leer o no cabe.
 */
export async function toItemWebp(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const { width, height } = itemImageSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of WEBP_QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (blob && blob.type === 'image/webp' && blob.size <= ITEM_IMAGE_MAX_BYTES) return blob;
  }
  return null;
}
