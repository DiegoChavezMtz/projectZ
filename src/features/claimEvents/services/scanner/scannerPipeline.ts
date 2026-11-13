import {
  detectBitmap,
  processBitmap,
  ScannerImageError,
  type FrameDetection,
  type ProcessOptions,
  type ProcessOutput,
} from './scannerImage';
import { decodeImage } from './decodeImage';
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
export const PROCESS_TIMEOUT_MS = 20_000;
export const DETECT_TIMEOUT_MS = 4_000;
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
        else entry.reject(new ScannerImageError(data.code, data.detail));
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

  // Un worker que ni responde ni falla (módulo que no cargó, p. ej. en un Safari viejo) no debe colgar la captura:
  // pasado el plazo se descarta el worker y el trabajo sigue en el hilo principal.
  const request = (target: Worker, message: (id: number) => WorkerRequest, timeoutMs: number) =>
    new Promise<WorkerResponse & { ok: true }>((resolve, reject) => {
      const id = (sequence += 1);
      const timer = setTimeout(() => {
        if (!pending.delete(id)) return;
        workerBroken = true;
        worker?.terminate();
        worker = null;
        reject(new ScannerImageError('worker_failed', 'El worker no respondió a tiempo'));
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      const built = message(id);
      target.postMessage(built, [built.bitmap]);
    });

  return {
    async process(source, options, signal) {
      if (signal?.aborted) throw abortError();
      const started = performance.now();
      const bitmap = await decodeImage(source);
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
          const response = await request(
            target,
            (id) => ({ id, kind: 'process', bitmap, options }),
            PROCESS_TIMEOUT_MS,
          );
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
          } catch (fallbackError) {
            // Se conserva la causa original del worker si el respaldo también falla sin detalle propio.
            if (fallbackError instanceof ScannerImageError && !fallbackError.detail && error instanceof ScannerImageError)
              throw new ScannerImageError(fallbackError.code, error.detail);
            throw fallbackError;
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
          const response = await request(
            target,
            (id) => ({ id, kind: 'detect', bitmap: frame }),
            DETECT_TIMEOUT_MS,
          );
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
