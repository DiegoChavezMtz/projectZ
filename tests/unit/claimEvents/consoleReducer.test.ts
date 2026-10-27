import { describe, expect, it } from 'vitest';
import type { ConsoleSnapshot } from '@/features/claimEvents/types';
import {
  consoleReducer,
  createConsoleState,
  mergeEntries,
} from '@/features/claimEvents/utils/consoleReducer';
import { consoleEntry, feedEvent, item, session } from './consoleFactories';

const snapshot: ConsoleSnapshot = {
  session: session({ status: 'live' }),
  items: [item({ id: 'b', position: 2 }), item({ id: 'a', position: 1 })],
  feed: [feedEvent(2), feedEvent(1)],
  entries: [consoleEntry({ id: 'e2', seq: 2 }), consoleEntry({ id: 'e1', seq: 1 })],
  buyers: [{ id: 'buyer-1', name: 'Luis', memberSince: '2026-01-01T00:00:00.000Z' }],
  wins: [],
  serverNow: '2026-10-26T10:00:00.000Z',
};

describe('consoleReducer (S7-01)', () => {
  it('arma el estado inicial ordenado por posición, id del feed y seq', () => {
    const state = createConsoleState(snapshot);
    expect(state.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(state.feed.map((e) => e.id)).toEqual([1, 2]);
    expect(state.entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(state.buyers['buyer-1']?.name).toBe('Luis');
  });

  it('no retrocede un artículo con una versión más vieja y deja ganar el empate', () => {
    let state = createConsoleState(snapshot);
    state = consoleReducer(state, {
      type: 'item',
      item: item({ id: 'a', position: 1, status: 'sold', updated_at: '2026-10-26T10:05:00.000Z' }),
    });
    state = consoleReducer(state, {
      type: 'item',
      item: item({
        id: 'a',
        position: 1,
        status: 'available',
        updated_at: '2026-10-26T10:01:00.000Z',
      }),
    });
    expect(state.items[0]?.status).toBe('sold');
    state = consoleReducer(state, {
      type: 'item',
      item: item({
        id: 'a',
        position: 1,
        status: 'withdrawn',
        updated_at: '2026-10-26T10:05:00.000Z',
      }),
    });
    expect(state.items[0]?.status).toBe('withdrawn');
  });

  it('deduplica el feed y respeta el orden por id', () => {
    let state = createConsoleState(snapshot);
    state = consoleReducer(state, { type: 'feed', event: feedEvent(4) });
    state = consoleReducer(state, { type: 'feed', event: feedEvent(3) });
    state = consoleReducer(state, { type: 'feed', event: feedEvent(4) });
    expect(state.feed.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it('un intento resuelto no vuelve a abrirse por un evento tardío', () => {
    const closed = consoleEntry({ id: 'e1', status: 'accepted' });
    const stale = consoleEntry({ id: 'e1', status: 'queued' });
    expect(mergeEntries([closed], [stale])[0]?.status).toBe('accepted');
    expect(mergeEntries([stale], [closed])[0]?.status).toBe('accepted');
  });

  it('el snapshot deshace un cambio optimista que el motor rechazó', () => {
    let state = createConsoleState(snapshot);
    state = consoleReducer(state, { type: 'entryStatus', entryId: 'e1', status: 'accepted' });
    expect(state.entries[0]?.status).toBe('accepted');
    state = consoleReducer(state, {
      type: 'snapshot',
      session: snapshot.session,
      items: snapshot.items,
      feed: snapshot.feed,
      entries: snapshot.entries,
    });
    expect(state.entries[0]?.status).toBe('queued');
  });

  it('marca y libera acciones en curso por clave', () => {
    let state = createConsoleState(snapshot);
    state = consoleReducer(state, { type: 'busyStart', key: 'entry:e1' });
    expect(state.busy['entry:e1']).toBe(true);
    state = consoleReducer(state, { type: 'busyDone', key: 'entry:e1' });
    expect(state.busy).toEqual({});
  });

  it('la sesión solo avanza con updated_at igual o mayor y la conexión no re-renderiza si no cambia', () => {
    let state = createConsoleState(snapshot);
    const older = session({ status: 'scheduled', updated_at: '2026-10-25T00:00:00.000Z' });
    expect(consoleReducer(state, { type: 'session', session: older })).toBe(state);
    state = consoleReducer(state, { type: 'connection', status: 'online' });
    expect(consoleReducer(state, { type: 'connection', status: 'online' })).toBe(state);
  });
});
