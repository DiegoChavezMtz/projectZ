import { ScannerImageError } from './scannerImage';

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** Decodifica con el HTMLImageElement del navegador (más tolerante que createImageBitmap con algunos formatos). */
function decodeWithImageElement(source: Blob): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();
    // Algunos navegadores nunca disparan load/error con formatos que no entienden: no se espera para siempre.
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Tiempo agotado al abrir la imagen'));
    }, 8000);
    image.onload = () => {
      window.clearTimeout(timeout);
      createImageBitmap(image).then(resolve, reject).finally(() => URL.revokeObjectURL(url));
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('El navegador no pudo abrir la imagen'));
    };
    image.src = url;
  });
}

/**
 * Decodifica la foto respetando la orientación EXIF (una foto de celular en vertical no debe salir de lado).
 * Orden: `createImageBitmap` con `imageOrientation: 'from-image'` (algunos navegadores viejos rechazan la
 * opción), luego sin opciones, luego `<img>`. Si todo falla: `decode_failed` con el detalle del último error.
 */
export async function decodeImage(source: Blob): Promise<ImageBitmap> {
  let lastError: unknown;
  for (const attempt of [
    () => createImageBitmap(source, { imageOrientation: 'from-image' }),
    () => createImageBitmap(source),
    ...(typeof document !== 'undefined' ? [() => decodeWithImageElement(source)] : []),
  ]) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw new ScannerImageError('decode_failed', `${describe(lastError)} (${source.type || 'tipo desconocido'}, ${source.size} B)`);
}
