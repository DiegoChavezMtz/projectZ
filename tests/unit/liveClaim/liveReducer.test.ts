import { describe, expect, it } from 'vitest';
import { backoffDelay } from '@/features/liveClaim/utils/backoff';
import { FEED_MEMORY_LIMIT } from '@/features/liveClaim/types';
import { createInitialState, liveReducer, mergeFeed } from '@/features/liveClaim/utils/liveReducer';
import { entry, feedEvent, item, session } from './factories';

const at = (minute: number) => `2026-10-26T10:${String(minute).padStart(2, '0')}:00.000Z`;
const start = () =>
  createInitialState({
    session: session(),
    items: [item({ id: 'a' }), item({ id: 'b', position: 2 })],
    feed: [],
  });

describe('items', () => {
  it('aplica una actualización más reciente y descarta una más vieja (fuera de orden)', () => {
    let state = start();
    state = liveReducer(state, {
      type: 'item',
      item: item({ id: 'a', status: 'sold', updated_at: at(5) }),
    });
    expect(state.items[0]?.status).toBe('sold');
    state = liveReducer(state, {
      type: 'item',
      item: item({ id: 'a', status: 'available', updated_at: at(3) }),
    });
    expect(state.items[0]?.status).toBe('sold');
  });

  it('un duplicado idéntico deja el mismo contenido', () => {
    const state = start();
    const next = liveReducer(state, { type: 'item', item: { ...state.items[0]! } });
    expect(next.items).toEqual(state.items);
    expect(next.items).toHaveLength(2);
  });

  it('con la misma marca de tiempo (misma transacción) gana la actualización que llega después', () => {
    // claim_item con auto_confirm: líder y luego vendida, ambas con el updated_at de la transacción.
    let state = start();
    state = liveReducer(state, {
      type: 'item',
      item: item({ id: 'a', status: 'available', leader_entry_id: 'e1', updated_at: at(5) }),
    });
    state = liveReducer(state, {
      type: 'item',
      item: item({ id: 'a', status: 'sold', leader_entry_id: 'e1', updated_at: at(5) }),
    });
    expect(state.items[0]?.status).toBe('sold');
  });

  it('inserta artículos nuevos en su posición', () => {
    const state = liveReducer(start(), {
      type: 'item',
      item: item({ id: 'c', position: 0, updated_at: at(1) }),
    });
    expect(state.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('feed', () => {
  it('dedupe y ordena por id', () => {
    let state = start();
    for (const id of [3, 1, 2, 2, 3])
      state = liveReducer(state, { type: 'feed', event: feedEvent(id) });
    expect(state.feed.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('conserva como máximo 200 eventos, los más recientes', () => {
    const many = Array.from({ length: FEED_MEMORY_LIMIT + 30 }, (_, i) => feedEvent(i + 1));
    const merged = mergeFeed([], many);
    expect(merged).toHaveLength(FEED_MEMORY_LIMIT);
    expect(merged[0]?.id).toBe(31);
    expect(merged.at(-1)?.id).toBe(FEED_MEMORY_LIMIT + 30);
  });
});

describe('evento', () => {
  it('actualiza el estado solo con un updated_at mayor', () => {
    let state = start();
    state = liveReducer(state, {
      type: 'session',
      session: session({ status: 'live', updated_at: at(2) }),
    });
    expect(state.session.status).toBe('live');
    state = liveReducer(state, {
      type: 'session',
      session: session({ status: 'scheduled', updated_at: at(1) }),
    });
    expect(state.session.status).toBe('live');
  });

  it('extender el cierre llega como actualización del evento', () => {
    let state = start();
    state = liveReducer(state, {
      type: 'session',
      session: session({ closes_at: at(30), updated_at: at(2) }),
    });
    state = liveReducer(state, {
      type: 'session',
      session: session({ closes_at: at(50), updated_at: at(3) }),
    });
    expect(state.session.closes_at).toBe(at(50));
  });
});

describe('reconexión (snapshot)', () => {
  it('mezcla lo nuevo sin pisar actualizaciones en vivo más recientes', () => {
    let state = start();
    state = liveReducer(state, {
      type: 'item',
      item: item({ id: 'a', status: 'sold', updated_at: at(9) }),
    });
    state = liveReducer(state, {
      type: 'snapshot',
      session: session({ updated_at: at(1) }),
      items: [
        item({ id: 'a', status: 'available', updated_at: at(4) }),
        item({ id: 'b', status: 'sold', position: 2, updated_at: at(8) }),
      ],
      feed: [feedEvent(7), feedEvent(8)],
    });
    expect(state.items.map((i) => i.status)).toEqual(['sold', 'sold']);
    expect(state.feed.map((e) => e.id)).toEqual([7, 8]);
  });

  it('quita los artículos que el snapshot ya no incluye', () => {
    const state = liveReducer(start(), {
      type: 'snapshot',
      session: session(),
      items: [item({ id: 'a' })],
      feed: [],
    });
    expect(state.items.map((i) => i.id)).toEqual(['a']);
  });
});

describe('conexión, intentos y acciones optimistas', () => {
  it('conexión', () => {
    expect(liveReducer(start(), { type: 'connection', status: 'online' }).connection).toBe(
      'online',
    );
  });

  it('pendingStart → pendingDone agrega el intento; pendingFail revierte', () => {
    let state = liveReducer(start(), {
      type: 'pendingStart',
      itemId: 'a',
      action: { kind: 'claim' },
    });
    expect(state.pending.a).toEqual({ kind: 'claim' });
    state = liveReducer(state, {
      type: 'pendingDone',
      itemId: 'a',
      entry: entry({ item_id: 'a' }),
    });
    expect(state.pending).toEqual({});
    expect(state.entries).toHaveLength(1);

    state = liveReducer(state, {
      type: 'pendingStart',
      itemId: 'b',
      action: { kind: 'offer', amountCents: 100 },
    });
    state = liveReducer(state, { type: 'pendingFail', itemId: 'b' });
    expect(state.pending).toEqual({});
    expect(state.entries).toHaveLength(1);
  });

  it('retirar marca el intento como withdrawn', () => {
    let state = liveReducer(start(), { type: 'entries', entries: [entry()] });
    state = liveReducer(state, { type: 'entryWithdrawn', entryId: 'entry-1' });
    expect(state.entries[0]?.status).toBe('withdrawn');
  });
});

describe('backoffDelay', () => {
  it('crece de forma exponencial con tope de 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });
});
