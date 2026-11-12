import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCaptureQueue,
  UploadError,
  type Uploader,
} from '@/features/claimEvents/services/scanner/captureQueue';
import { createMemoryCaptureStore } from '@/features/claimEvents/services/scanner/captureStore';

const blob = () => new Blob(['x'], { type: 'image/webp' });
let counter = 0;
const make = (upload: Uploader, store = createMemoryCaptureStore()) =>
  createCaptureQueue({ store, upload, newId: () => `c${(counter += 1)}` });

beforeEach(() => {
  vi.useFakeTimers();
  counter = 0;
});
afterEach(() => vi.useRealTimers());

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('cola de subida persistente', () => {
  it('sube una captura y guarda el artículo creado', async () => {
    const upload = vi.fn<Uploader>(async () => ({ itemId: 'item-1' }));
    const queue = make(upload);
    await queue.add({ sessionId: 's', blob: blob(), priceCents: 155050 });
    await settle();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]![0]).toMatchObject({ priceCents: 155050, status: 'uploading' });
    expect(queue.snapshot()[0]).toMatchObject({ status: 'done', itemId: 'item-1' });
  });

  it('nunca corre más de 3 subidas a la vez', async () => {
    let active = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const upload: Uploader = () =>
      new Promise((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        releases.push(() => {
          active -= 1;
          resolve({ itemId: 'i' });
        });
      });
    const queue = make(upload);
    for (let i = 0; i < 7; i += 1) {
      await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
      vi.setSystemTime(Date.now() + 1);
    }
    await settle();
    expect(active).toBe(3);
    while (releases.length) {
      releases.shift()!();
      await settle();
    }
    expect(peak).toBe(3);
    expect(queue.snapshot().every((e) => e.status === 'done')).toBe(true);
  });

  it('reintenta con backoff y termina', async () => {
    const upload = vi
      .fn<Uploader>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ itemId: 'ok' });
    const queue = make(upload);
    await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    expect(queue.snapshot()[0]).toMatchObject({
      status: 'queued',
      attempts: 1,
      errorCode: 'network',
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(upload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(upload).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(queue.snapshot()[0]).toMatchObject({ status: 'done', itemId: 'ok' });
  });

  it('un error no reintentable queda en error hasta el reintento manual', async () => {
    const upload = vi
      .fn<Uploader>()
      .mockRejectedValueOnce(new UploadError('forbidden', false))
      .mockResolvedValue({ itemId: 'ok' });
    const queue = make(upload);
    const entry = await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(queue.snapshot()[0]).toMatchObject({ status: 'error', errorCode: 'forbidden' });
    await queue.retry(entry.id);
    await settle();
    expect(queue.snapshot()[0]!.status).toBe('done');
  });

  it('recarga a mitad de la subida sin perder la captura', async () => {
    const store = createMemoryCaptureStore();
    const stuck: Uploader = () => new Promise(() => {}); // la página se "cierra" con la subida en curso
    const first = make(stuck, store);
    await first.add({ sessionId: 's', blob: blob(), priceCents: 9900 });
    await first.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    expect(first.snapshot().some((e) => e.status === 'uploading')).toBe(true);
    first.dispose();

    const upload = vi.fn<Uploader>(async () => ({ itemId: 'again' }));
    const second = make(upload, store);
    const restored = await second.load('s');
    expect(restored).toHaveLength(2);
    await settle();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(second.snapshot().map((e) => e.status)).toEqual(['done', 'done']);
    expect(second.snapshot()[0]!.priceCents).toBe(9900);
  });

  it('la captura ya está en disco antes de subir', async () => {
    const store = createMemoryCaptureStore();
    const queue = make(() => new Promise(() => {}), store);
    const entry = await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    expect((await store.get(entry.id))?.blob.size).toBe(1);
  });

  it('descartar y limpiar quitan de la cola y del almacén', async () => {
    const store = createMemoryCaptureStore();
    const queue = make(async () => ({ itemId: 'i' }), store);
    const a = await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    await queue.discard(a.id);
    expect(queue.snapshot()).toHaveLength(0);
    expect(await store.get(a.id)).toBeUndefined();
    await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    await queue.clearDone('s');
    expect(await store.listBySession('s')).toHaveLength(0);
  });

  it('avisa a los suscriptores en cada cambio y deja de avisar al darse de baja', async () => {
    const queue = make(async () => ({ itemId: 'i' }));
    const listener = vi.fn();
    const off = queue.subscribe(listener);
    await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    off();
    await queue.add({ sessionId: 's', blob: blob(), priceCents: null });
    await settle();
    expect(listener.mock.calls.length).toBe(calls);
  });
});
