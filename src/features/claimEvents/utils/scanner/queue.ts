// Lógica pura de la cola de subida del modo escáner (sin IndexedDB ni red; ver services/captureQueue.service.ts).

export type CaptureStatus = 'queued' | 'uploading' | 'done' | 'error';

export type CaptureEntry = {
  id: string;
  sessionId: string;
  status: CaptureStatus;
  /** Precio en centavos; null = omitido (artículo incompleto). */
  priceCents: number | null;
  attempts: number;
  /** Marca de tiempo (ms) a partir de la cual se puede reintentar. */
  nextAttemptAt: number;
  createdAt: number;
  /** Artículo creado (o reemplazado) cuando la subida terminó. */
  itemId: string | null;
  /** Si existe, la captura reemplaza la imagen de ese artículo en lugar de crear uno. */
  replaceItemId: string | null;
  errorCode: string | null;
};

export const MAX_CONCURRENT_UPLOADS = 3;
export const MAX_AUTO_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/** 1 s, 2 s, 4 s, … con tope de 30 s. */
export const backoffMs = (attempts: number): number =>
  Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));

/** Entradas que se pueden iniciar ahora, respetando el máximo de subidas simultáneas y el orden de captura. */
export function pickRunnable(
  entries: readonly CaptureEntry[],
  now: number,
  max = MAX_CONCURRENT_UPLOADS,
): CaptureEntry[] {
  const running = entries.filter((e) => e.status === 'uploading').length;
  const free = Math.max(0, max - running);
  return entries
    .filter((e) => e.status === 'queued' && e.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, free);
}

/** Registra un fallo: reintento con backoff, o `error` (reintento manual) si no es reintentable o se agotó. */
export function markFailed(
  entry: CaptureEntry,
  now: number,
  errorCode: string,
  retryable: boolean,
): CaptureEntry {
  const attempts = entry.attempts + 1;
  if (!retryable || attempts >= MAX_AUTO_ATTEMPTS)
    return { ...entry, attempts, status: 'error', errorCode };
  return {
    ...entry,
    attempts,
    status: 'queued',
    errorCode,
    nextAttemptAt: now + backoffMs(attempts),
  };
}

export const markDone = (entry: CaptureEntry, itemId: string): CaptureEntry => ({
  ...entry,
  status: 'done',
  itemId,
  errorCode: null,
});

/** Reintento manual: reinicia los intentos y lo deja listo para correr ya. */
export const retryNow = (entry: CaptureEntry, now: number): CaptureEntry => ({
  ...entry,
  status: 'queued',
  attempts: 0,
  errorCode: null,
  nextAttemptAt: now,
});

/** Tras recargar la página una subida "en curso" quedó a medias: vuelve a la cola. */
export const recoverAfterReload = (entries: readonly CaptureEntry[]): CaptureEntry[] =>
  entries.map((e) => (e.status === 'uploading' ? { ...e, status: 'queued', nextAttemptAt: 0 } : e));

/** Milisegundos hasta el próximo reintento programado, o null si no hay nada esperando. */
export function nextWakeDelay(entries: readonly CaptureEntry[], now: number): number | null {
  const waiting = entries.filter((e) => e.status === 'queued').map((e) => e.nextAttemptAt);
  if (waiting.length === 0) return null;
  return Math.max(0, Math.min(...waiting) - now);
}

export const pendingCount = (entries: readonly CaptureEntry[]): number =>
  entries.filter((e) => e.status === 'queued' || e.status === 'uploading').length;
