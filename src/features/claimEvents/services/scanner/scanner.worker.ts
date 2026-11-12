/// <reference lib="webworker" />
import {
  ScannerImageError,
  detectBitmap,
  processBitmap,
  type FrameDetection,
  type ProcessOptions,
  type ProcessOutput,
} from './scannerImage';

export type WorkerRequest =
  | { id: number; kind: 'process'; bitmap: ImageBitmap; options: ProcessOptions }
  | { id: number; kind: 'detect'; bitmap: ImageBitmap };
export type WorkerResponse =
  | ({ id: number; ok: true; kind: 'process' } & ProcessOutput)
  | { id: number; ok: true; kind: 'detect'; detection: FrameDetection | null }
  | { id: number; ok: false; code: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, bitmap } = data;
  try {
    if (data.kind === 'detect') {
      scope.postMessage({
        id,
        ok: true,
        kind: 'detect',
        detection: detectBitmap(bitmap),
      } satisfies WorkerResponse);
    } else {
      const output = await processBitmap(bitmap, data.options);
      scope.postMessage({ id, ok: true, kind: 'process', ...output } satisfies WorkerResponse);
    }
  } catch (error) {
    const code = error instanceof ScannerImageError ? error.code : 'worker_failed';
    scope.postMessage({ id, ok: false, code } satisfies WorkerResponse);
  } finally {
    bitmap.close();
  }
};
