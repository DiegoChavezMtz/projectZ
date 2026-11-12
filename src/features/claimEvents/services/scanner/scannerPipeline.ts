import {
  detectBitmap,
  processBitmap,
  ScannerImageError,
  type FrameDetection,
  type ProcessOptions,
  type ProcessOutput,
} from './scannerImage';
import type { WorkerRequest, WorkerResponse } from './scanner.worker';

export type PipelineResult = ProcessOutput & {
  /** Verdadero si el trabajo corrió en el hilo principal porque el Worker no estaba disponible o falló. */
  degraded: boolean;
  ms: number;
};

type Pending = {
  resolve: (value: WorkerResponse & { ok: true }) => void;
  reject: (error: Error) => void;
};

export type ScannerPipeline = {
  process(source: Blob, options: ProcessOptions, signal?: AbortSignal): Promise<PipelineResult>;
  /** Detecta el contorno en un cuadro del video (guía de encuadre en vivo). Consume (cierra) el bitmap. */
  detect(frame: ImageBitmap): Promise<FrameDetection | null>;
  dispose(): void;
};

const abortError = () => new DOMException('Cancelado', 'AbortError');
const FATAL = ['decode_failed', 'encode_failed'];

/**
 * Pipeline de imagen del escáner. El trabajo pesado corre en un Web Worker (se crea al primer uso, así el
 * código solo se descarga al abrir el modo escáner). Si el Worker no existe o falla, se procesa en el hilo
 * principal con el mismo código, y el resultado se marca `degraded`.
 */
export function createScannerPipeline(): ScannerPipeline {
  let worker: Worker | null = null;
  let workerBroken = typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined';
  let sequence = 0;
  const pending = new Map<number, Pending>();

  const failAll = (error: Error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  const ensureWorker = (): Worker | null => {
    if (workerBroken) return null;
    if (worker) return worker;
    try {
      const created = new Worker(new URL('./scanner.worker.ts', import.meta.url), {
        type: 'module',
      });
      created.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        const entry = pending.get(data.id);
        if (!entry) return;
        pending.delete(data.id);
        if (data.ok) entry.resolve(data);
        else entry.reject(new ScannerImageError(data.code));
      };
      created.onerror = () => {
        workerBroken = true;
        worker?.terminate();
        worker = null;
        failAll(new ScannerImageError('worker_failed'));
      };
      worker = created;
    } catch {
      workerBroken = true;
    }
    return worker;
  };

  const request = (target: Worker, message: (id: number) => WorkerRequest) =>
    new Promise<WorkerResponse & { ok: true }>((resolve, reject) => {
      const id = (sequence += 1);
      pending.set(id, { resolve, reject });
      const built = message(id);
      target.postMessage(built, [built.bitmap]);
    });

  return {
    async process(source, options, signal) {
      if (signal?.aborted) throw abortError();
      const started = performance.now();
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(source);
      } catch {
        throw new ScannerImageError('decode_failed');
      }
      if (signal?.aborted) {
        bitmap.close();
        throw abortError();
      }

      const target = ensureWorker();
      let output: ProcessOutput;
      let degraded = false;
      if (target) {
        // El worker consume (transfiere) el bitmap: se conserva una copia solo para el posible respaldo.
        const backup = await createImageBitmap(bitmap);
        try {
          const response = await request(target, (id) => ({
            id,
            kind: 'process',
            bitmap,
            options,
          }));
          if (response.kind !== 'process') throw new ScannerImageError('worker_failed');
          output = response;
          backup.close();
        } catch (error) {
          if (error instanceof ScannerImageError && FATAL.includes(error.code)) {
            backup.close();
            throw error;
          }
          degraded = true;
          try {
            output = await processBitmap(backup, options);
          } finally {
            backup.close();
          }
        }
      } else {
        degraded = true;
        try {
          output = await processBitmap(bitmap, options);
        } finally {
          bitmap.close();
        }
      }
      if (signal?.aborted) throw abortError();
      return { ...output, degraded, ms: performance.now() - started };
    },

    async detect(frame) {
      const target = ensureWorker();
      if (target) {
        try {
          const response = await request(target, (id) => ({ id, kind: 'detect', bitmap: frame }));
          return response.kind === 'detect' ? response.detection : null;
        } catch {
          return null; // la guía es una ayuda: si falla, simplemente no orienta
        }
      }
      try {
        return detectBitmap(frame);
      } finally {
        frame.close();
      }
    },

    dispose() {
      failAll(abortError());
      worker?.terminate();
      worker = null;
    },
  };
}
