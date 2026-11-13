/// <reference lib="webworker" />
import {
  ScannerImageError,
  detectBitmap,
  detectManyBitmap,
  type MultiResult,
  processBitmap,
  type FrameDetection,
  type ProcessOptions,
  type ProcessOutput,
} from './scannerImage';
import type { Aspect } from '../../utils/scanner/types';

export type WorkerRequest =
  | { id: number; kind: 'process'; bitmap: ImageBitmap; options: ProcessOptions }
  | { id: number; kind: 'detect'; bitmap: ImageBitmap }
  | { id: number; kind: 'detectMany'; bitmap: ImageBitmap; aspect: Aspect };
export type WorkerResponse =
  | ({ id: number; ok: true; kind: 'process' } & ProcessOutput)
  | { id: number; ok: true; kind: 'detect'; detection: FrameDetection | null }
  | { id: number; ok: true; kind: 'detectMany'; multi: MultiResult }
  | { id: number; ok: false; code: string; detail?: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, bitmap } = data;
  try {
    if (data.kind === 'detectMany') {
      scope.postMessage({ id, ok: true, kind: 'detectMany', multi: detectManyBitmap(bitmap, data.aspect) } satisfies WorkerResponse);
    } else if (data.kind === 'detect') {
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
    const known = error instanceof ScannerImageError;
    scope.postMessage({
      id,
      ok: false,
      code: known ? error.code : 'worker_failed',
      detail: known ? error.detail : error instanceof Error ? `${error.name}: ${error.message}` : undefined,
    } satisfies WorkerResponse);
  } finally {
    bitmap.close();
  }
};
