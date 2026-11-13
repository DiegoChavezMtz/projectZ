import {
  markDone,
  markFailed,
  nextWakeDelay,
  pickRunnable,
  recoverAfterReload,
  retryNow,
  type CaptureEntry,
} from '../../utils/scanner/queue';
import type { CaptureRecord, CaptureStore } from './captureStore';

/** `crypto.randomUUID` no existe en Safari < 15.4 ni fuera de contextos seguros: respaldo con `getRandomValues`. */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // versión 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Lo que el uploader lanza: `retryable` decide si se reintenta solo o se pide acción del vendedor. */
export class UploadError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

export type Uploader = (entry: CaptureEntry, blob: Blob) => Promise<{ itemId: string }>;

export type NewCapture = {
  sessionId: string;
  blob: Blob;
  priceCents: number | null;
  replaceItemId?: string | null;
};

export type CaptureQueue = {
  /** Carga lo persistido de la sesión (tras una recarga) y reanuda las subidas pendientes. */
  load(sessionId: string): Promise<CaptureEntry[]>;
  add(capture: NewCapture): Promise<CaptureEntry>;
  retry(id: string): Promise<void>;
  /** Quita la captura de la cola (y de IndexedDB). No borra el artículo ya creado. */
  discard(id: string): Promise<void>;
  /** Limpia las capturas terminadas de la sesión al salir del modo escáner. */
  clearDone(sessionId: string): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
  /** Reintenta ya lo que esté esperando (por ejemplo, al volver la conexión). */
  kick(): void;
  snapshot(): CaptureEntry[];
  subscribe(listener: (entries: CaptureEntry[]) => void): () => void;
  dispose(): void;
};

type Options = {
  store: CaptureStore;
  upload: Uploader;
  now?: () => number;
  newId?: () => string;
};

/** Cola de subida: IndexedDB + reintento con backoff + máximo 3 subidas simultáneas (lógica en utils/scanner/queue). */
export function createCaptureQueue({
  store,
  upload,
  now = Date.now,
  newId = randomId,
}: Options): CaptureQueue {
  let entries: CaptureEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const listeners = new Set<(entries: CaptureEntry[]) => void>();

  const emit = () => listeners.forEach((listener) => listener(entries));
  const replace = (next: CaptureEntry) => {
    entries = entries.map((entry) => (entry.id === next.id ? next : entry));
    emit();
  };
  const persist = async (entry: CaptureEntry) => {
    const record = await store.get(entry.id);
    if (record) await store.put({ ...entry, blob: record.blob });
  };

  const run = async (entry: CaptureEntry) => {
    const uploading: CaptureEntry = { ...entry, status: 'uploading' };
    replace(uploading);
    await persist(uploading);
    let next: CaptureEntry;
    try {
      const record = await store.get(entry.id);
      if (!record) return; // se descartó mientras esperaba
      const { itemId } = await upload(uploading, record.blob);
      next = markDone(uploading, itemId);
    } catch (error) {
      const known = error instanceof UploadError;
      next = markFailed(
        uploading,
        now(),
        known ? error.code : 'network',
        known ? error.retryable : true,
      );
    }
    if (disposed || !entries.some((e) => e.id === next.id)) return;
    replace(next);
    await persist(next);
  };

  const pump = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = null;
    for (const entry of pickRunnable(entries, now())) void run(entry).finally(pump);
    const delay = nextWakeDelay(entries, now());
    if (delay !== null && delay > 0) timer = setTimeout(pump, delay);
  };

  return {
    async load(sessionId) {
      const records = await store.listBySession(sessionId);
      const recovered = recoverAfterReload(records);
      entries = recovered;
      await Promise.all(recovered.map((entry) => persist(entry)));
      emit();
      pump();
      return entries;
    },
    async add({ sessionId, blob, priceCents, replaceItemId = null }) {
      const entry: CaptureEntry = {
        id: newId(),
        sessionId,
        status: 'queued',
        priceCents,
        attempts: 0,
        nextAttemptAt: 0,
        createdAt: now(),
        itemId: null,
        replaceItemId,
        errorCode: null,
      };
      // Primero a disco y luego a la cola: si la página se recarga justo aquí, la captura no se pierde.
      const record: CaptureRecord = { ...entry, blob };
      await store.put(record);
      entries = [...entries, entry];
      emit();
      pump();
      return entry;
    },
    async retry(id) {
      const current = entries.find((entry) => entry.id === id);
      if (!current) return;
      const next = retryNow(current, now());
      replace(next);
      await persist(next);
      pump();
    },
    async discard(id) {
      entries = entries.filter((entry) => entry.id !== id);
      emit();
      await store.delete(id);
    },
    async clearDone(sessionId) {
      const done = entries.filter(
        (entry) => entry.sessionId === sessionId && entry.status === 'done',
      );
      entries = entries.filter((entry) => !done.includes(entry));
      emit();
      await Promise.all(done.map((entry) => store.delete(entry.id)));
    },
    getBlob: async (id) => (await store.get(id))?.blob,
    kick: pump,
    snapshot: () => entries,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      listeners.clear();
    },
  };
}
