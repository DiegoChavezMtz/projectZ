import type { CaptureEntry } from '../../utils/scanner/queue';

/** Captura persistida: la fila de la cola más la imagen ya recortada (WebP) lista para subir. */
export type CaptureRecord = CaptureEntry & { blob: Blob };

export type CaptureStore = {
  put(record: CaptureRecord): Promise<void>;
  get(id: string): Promise<CaptureRecord | undefined>;
  listBySession(sessionId: string): Promise<CaptureRecord[]>;
  delete(id: string): Promise<void>;
  deleteBySession(sessionId: string): Promise<void>;
};

const DB_NAME = 'zlotify-scanner';
const STORE = 'captures';

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('sessionId', 'sessionId');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** Persistencia en IndexedDB: una captura sobrevive a recargas y a caídas de conexión. */
export function createIdbCaptureStore(factory: IDBFactory = indexedDB): CaptureStore {
  let database: Promise<IDBDatabase> | null = null;
  const store = async (mode: IDBTransactionMode) => {
    database ??= openDatabase(factory);
    return (await database).transaction(STORE, mode).objectStore(STORE);
  };
  return {
    async put(record) {
      await request((await store('readwrite')).put(record));
    },
    async get(id) {
      return (await request((await store('readonly')).get(id))) as CaptureRecord | undefined;
    },
    async listBySession(sessionId) {
      const all = (await request(
        (await store('readonly')).index('sessionId').getAll(sessionId),
      )) as CaptureRecord[];
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    async delete(id) {
      await request((await store('readwrite')).delete(id));
    },
    async deleteBySession(sessionId) {
      const records = await this.listBySession(sessionId);
      await Promise.all(records.map((record) => this.delete(record.id)));
    },
  };
}

/** Misma interfaz en memoria: pruebas y navegadores sin IndexedDB (la cola sigue funcionando, sin persistir). */
export function createMemoryCaptureStore(): CaptureStore {
  const records = new Map<string, CaptureRecord>();
  return {
    async put(record) {
      records.set(record.id, record);
    },
    async get(id) {
      return records.get(id);
    },
    async listBySession(sessionId) {
      return [...records.values()]
        .filter((record) => record.sessionId === sessionId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async delete(id) {
      records.delete(id);
    },
    async deleteBySession(sessionId) {
      for (const [id, record] of records) if (record.sessionId === sessionId) records.delete(id);
    },
  };
}

/**
 * IndexedDB puede fallar (modo privado de Safari, almacenamiento lleno, política del navegador). En ese caso la
 * cola sigue funcionando en memoria: se pierde la persistencia tras recargar, pero no la captura.
 */
export function createResilientCaptureStore(primary: () => CaptureStore): CaptureStore {
  const memory = createMemoryCaptureStore();
  let store: CaptureStore | null = null;
  let degraded = false;
  try {
    store = primary();
  } catch {
    degraded = true;
  }
  const run = async <T>(op: (s: CaptureStore) => Promise<T>): Promise<T> => {
    if (!degraded && store) {
      try {
        return await op(store);
      } catch {
        degraded = true;
      }
    }
    return op(memory);
  };
  return {
    put: (record) => run((s) => s.put(record)),
    get: (id) => run((s) => s.get(id)),
    listBySession: (sessionId) => run((s) => s.listBySession(sessionId)),
    delete: (id) => run((s) => s.delete(id)),
    deleteBySession: (sessionId) => run((s) => s.deleteBySession(sessionId)),
  };
}
