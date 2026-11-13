import { itemImageSize } from '../utils/image';
import { encodeWithFallback } from '../utils/scanner/encode';

/**
 * Redimensiona (lado mayor ≤ 1600 px) y convierte a WebP en el navegador (a JPEG si el navegador no sabe
 * codificar WebP, como Safari). Baja la calidad hasta que el resultado cabe en el límite del bucket. Devuelve null si el archivo no se pudo leer o no cabe.
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

  const result = await encodeWithFallback(
    (type, quality) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality)),
  );
  return result.ok ? result.blob : null;
}
