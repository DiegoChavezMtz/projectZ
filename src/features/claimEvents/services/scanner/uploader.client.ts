import type { Uploader } from './captureQueue';
import { UploadError } from './captureQueue';
import { saveCaptureAction } from './scanner.actions';

/** Sube una captura con la Server Action de S11-05. Un fallo de red o de servidor se reintenta; lo demás no. */
export const uploadCapture: Uploader = async (entry, blob) => {
  const data = new FormData();
  data.set('sessionId', entry.sessionId);
  data.set('captureId', entry.id);
  data.set('priceCents', entry.priceCents === null ? '' : String(entry.priceCents));
  if (entry.replaceItemId) data.set('replaceItemId', entry.replaceItemId);
  data.set('image', new File([blob], 'item.webp', { type: 'image/webp' }));
  let result: Awaited<ReturnType<typeof saveCaptureAction>>;
  try {
    result = await saveCaptureAction(data);
  } catch {
    throw new UploadError('network', true);
  }
  if (result.status === 'error') throw new UploadError(result.code, result.retryable);
  return { itemId: result.itemId };
};
