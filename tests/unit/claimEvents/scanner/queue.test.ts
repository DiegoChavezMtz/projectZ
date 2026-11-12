import { describe, expect, it } from 'vitest';
import {
  MAX_AUTO_ATTEMPTS,
  backoffMs,
  markDone,
  markFailed,
  nextWakeDelay,
  pendingCount,
  pickRunnable,
  recoverAfterReload,
  retryNow,
  type CaptureEntry,
} from '@/features/claimEvents/utils/scanner/queue';

const entry = (over: Partial<CaptureEntry> = {}): CaptureEntry => ({
  id: 'a',
  sessionId: 's',
  status: 'queued',
  priceCents: null,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 1,
  itemId: null,
  replaceItemId: null,
  errorCode: null,
  ...over,
});

describe('cola de subida (lógica pura)', () => {
  it('backoff exponencial con tope', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });
  it('arranca como máximo 3 simultáneas, en orden de captura', () => {
    const list = [5, 3, 1, 2, 4].map((n) => entry({ id: `e${n}`, createdAt: n }));
    expect(pickRunnable(list, 100).map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
  it('descuenta las que ya están subiendo', () => {
    const list = [
      entry({ id: 'u1', status: 'uploading' }),
      entry({ id: 'u2', status: 'uploading' }),
      entry({ id: 'q1', createdAt: 1 }),
      entry({ id: 'q2', createdAt: 2 }),
    ];
    expect(pickRunnable(list, 100).map((e) => e.id)).toEqual(['q1']);
    expect(pickRunnable([...list, entry({ id: 'u3', status: 'uploading' })], 100)).toEqual([]);
  });
  it('respeta la espera de backoff', () => {
    const list = [
      entry({ id: 'w', nextAttemptAt: 500 }),
      entry({ id: 'r', nextAttemptAt: 50, createdAt: 2 }),
    ];
    expect(pickRunnable(list, 100).map((e) => e.id)).toEqual(['r']);
    expect(nextWakeDelay(list, 100)).toBe(0);
    expect(nextWakeDelay([list[0]!], 100)).toBe(400);
    expect(nextWakeDelay([entry({ status: 'done' })], 100)).toBeNull();
  });
  it('un fallo reintentable vuelve a la cola con backoff', () => {
    const failed = markFailed(entry({ status: 'uploading' }), 1000, 'network', true);
    expect(failed).toMatchObject({
      status: 'queued',
      attempts: 1,
      nextAttemptAt: 2000,
      errorCode: 'network',
    });
  });
  it('un fallo no reintentable o agotado queda en error', () => {
    expect(markFailed(entry(), 0, 'forbidden', false).status).toBe('error');
    expect(markFailed(entry({ attempts: MAX_AUTO_ATTEMPTS - 1 }), 0, 'network', true).status).toBe(
      'error',
    );
  });
  it('reintento manual reinicia intentos', () => {
    const retried = retryNow(entry({ status: 'error', attempts: 6, errorCode: 'x' }), 9);
    expect(retried).toMatchObject({
      status: 'queued',
      attempts: 0,
      errorCode: null,
      nextAttemptAt: 9,
    });
  });
  it('terminada guarda el artículo', () => {
    expect(markDone(entry({ status: 'uploading' }), 'item-1')).toMatchObject({
      status: 'done',
      itemId: 'item-1',
    });
  });
  it('tras recargar, lo que estaba subiendo vuelve a la cola', () => {
    const list = recoverAfterReload([
      entry({ id: 'u', status: 'uploading', nextAttemptAt: 99 }),
      entry({ id: 'd', status: 'done' }),
    ]);
    expect(list.map((e) => e.status)).toEqual(['queued', 'done']);
    expect(list[0]!.nextAttemptAt).toBe(0);
  });
  it('cuenta pendientes', () => {
    expect(
      pendingCount([
        entry(),
        entry({ status: 'uploading' }),
        entry({ status: 'done' }),
        entry({ status: 'error' }),
      ]),
    ).toBe(2);
  });
});
