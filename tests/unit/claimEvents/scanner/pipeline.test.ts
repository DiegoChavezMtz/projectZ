import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PROCESS_TIMEOUT_MS,
  createScannerPipeline,
} from '@/features/claimEvents/services/scanner/scannerPipeline';

const output = {
  blob: new Blob(['w'], { type: 'image/webp' }),
  corners: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  detected: true,
  confidence: 0.9,
  sourceAspect: 1,
  cropLongSide: 1500,
  lowResolution: false,
};

const processBitmap = vi.fn();
vi.mock('@/features/claimEvents/services/scanner/scannerImage', async (original) => ({
  ...(await original<typeof import('@/features/claimEvents/services/scanner/scannerImage')>()),
  processBitmap: (...args: unknown[]) => processBitmap(...args),
  detectBitmap: (...args: unknown[]) => detectBitmap(...args),
}));

const detection = { corners: output.corners, confidence: 0.9 };
const detectBitmap = vi.fn();
const bitmap = () => ({ width: 10, height: 10, close: vi.fn() }) as unknown as ImageBitmap;

afterEach(() => {
  vi.unstubAllGlobals();
  processBitmap.mockReset();
});

describe('pipeline del escáner', () => {
  it('sin Worker procesa en el hilo principal y lo marca degradado', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap()),
    );
    processBitmap.mockResolvedValue(output);
    const result = await createScannerPipeline().process(new Blob(['x']), {
      aspect: { width: 63, height: 88 },
    });
    expect(result).toMatchObject({ degraded: true, detected: true });
    expect(processBitmap).toHaveBeenCalledTimes(1);
  });

  it('con Worker delega el trabajo y no toca el hilo principal', async () => {
    const posted: unknown[] = [];
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: { id: number }) {
        posted.push(message);
        queueMicrotask(() =>
          this.onmessage?.({
            data: { id: message.id, ok: true, kind: 'process', ...output },
          } as MessageEvent),
        );
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap()),
    );
    const pipeline = createScannerPipeline();
    const result = await pipeline.process(new Blob(['x']), { aspect: { width: 63, height: 88 } });
    expect(result.degraded).toBe(false);
    expect(posted).toHaveLength(1);
    expect(processBitmap).not.toHaveBeenCalled();
    pipeline.dispose();
  });

  it('si el Worker falla, cae al hilo principal', async () => {
    class BrokenWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: { id: number }) {
        queueMicrotask(() =>
          this.onmessage?.({
            data: { id: message.id, ok: false, code: 'worker_failed' },
          } as MessageEvent),
        );
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', BrokenWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap()),
    );
    processBitmap.mockResolvedValue({ ...output, detected: false });
    const result = await createScannerPipeline().process(new Blob(['x']), {
      aspect: { width: 63, height: 88 },
    });
    expect(result).toMatchObject({ degraded: true, detected: false });
  });

  it('detect: sin Worker analiza en el hilo principal y libera el cuadro', async () => {
    vi.stubGlobal('Worker', undefined);
    detectBitmap.mockReturnValue(detection);
    const frame = bitmap();
    expect(await createScannerPipeline().detect(frame)).toEqual(detection);
    expect(frame.close).toHaveBeenCalled();
  });

  it('detect: con Worker delega y si falla devuelve null (la guía es solo una ayuda)', async () => {
    class W {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      mode = 'ok';
      postMessage(m: { id: number; kind: string }) {
        queueMicrotask(() =>
          this.onmessage?.({
            data:
              m.kind === 'detect'
                ? { id: m.id, ok: true, kind: 'detect', detection }
                : { id: m.id, ok: false, code: 'x' },
          } as MessageEvent),
        );
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', W);
    vi.stubGlobal('OffscreenCanvas', class {});
    expect(await createScannerPipeline().detect(bitmap())).toEqual(detection);
  });

  it('un worker que no responde nunca no cuelga: tras el plazo se procesa en el hilo principal', async () => {
    vi.useFakeTimers();
    try {
      class SilentWorker {
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: (() => void) | null = null;
        postMessage() {}
        terminate = vi.fn();
      }
      vi.stubGlobal('Worker', SilentWorker);
      vi.stubGlobal('OffscreenCanvas', class {});
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn(async () => bitmap()),
      );
      processBitmap.mockResolvedValue(output);
      const pending = createScannerPipeline().process(new Blob(['x']), {
        aspect: { width: 63, height: 88 },
      });
      await vi.advanceTimersByTimeAsync(PROCESS_TIMEOUT_MS + 10);
      await expect(pending).resolves.toMatchObject({ degraded: true });
      expect(processBitmap).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('una foto que no se puede decodificar es un error claro', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => Promise.reject(new Error('bad'))),
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
    });
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    await expect(
      createScannerPipeline().process(new Blob(['x']), { aspect: { width: 1, height: 1 } }),
    ).rejects.toMatchObject({
      code: 'decode_failed',
    });
  });

  it('se puede cancelar antes y después de decodificar', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap()),
    );
    processBitmap.mockResolvedValue(output);
    const controller = new AbortController();
    controller.abort();
    await expect(
      createScannerPipeline().process(
        new Blob(['x']),
        { aspect: { width: 1, height: 1 } },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const late = new AbortController();
    const pending = createScannerPipeline().process(
      new Blob(['x']),
      { aspect: { width: 1, height: 1 } },
      late.signal,
    );
    late.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
