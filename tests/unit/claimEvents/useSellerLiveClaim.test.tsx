import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleRealtimeHandlers } from '@/features/claimEvents/services/consoleRealtime.service';
import type { ConsoleSnapshot } from '@/features/claimEvents/types';
import { consoleEntry, feedEvent, item, session } from './consoleFactories';

// S7-01: el hook con Realtime simulado (misma lógica de reconexión que el visor, compartida).
const channels: { handlers: ConsoleRealtimeHandlers; unsubscribe: ReturnType<typeof vi.fn> }[] = [];
const fetchState = vi.fn();
const fetchBuyers = vi.fn();
const fetchWins = vi.fn();

vi.mock('@/features/claimEvents/services/consoleRealtime.service', () => ({
  consoleRealtimeService: {
    subscribe: (_id: string, handlers: ConsoleRealtimeHandlers) => {
      const unsubscribe = vi.fn();
      channels.push({ handlers, unsubscribe });
      return unsubscribe;
    },
  },
}));
vi.mock('@/features/claimEvents/services/consoleData.client', () => ({
  consoleDataClient: {
    fetchState: (...a: unknown[]) => fetchState(...a),
    fetchBuyers: (...a: unknown[]) => fetchBuyers(...a),
    fetchWins: (...a: unknown[]) => fetchWins(...a),
  },
}));

const { useSellerLiveClaim } = await import('@/features/claimEvents/hooks/useSellerLiveClaim');

const snapshot: ConsoleSnapshot = {
  session: session({ status: 'live', updated_at: '2026-10-26T10:00:00.000Z' }),
  items: [item({ id: 'a' })],
  feed: [feedEvent(1)],
  entries: [],
  buyers: [],
  wins: [],
  serverNow: '2026-10-26T10:00:00.000Z',
};
const current = () => channels.at(-1)!;
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));

beforeEach(() => {
  vi.useFakeTimers();
  channels.length = 0;
  fetchState.mockReset().mockResolvedValue({
    type: 'snapshot',
    session: snapshot.session,
    items: snapshot.items,
    feed: snapshot.feed,
    entries: [],
  });
  fetchBuyers
    .mockReset()
    .mockResolvedValue([{ id: 'buyer-1', name: 'Luis', memberSince: '2026-01-01T00:00:00.000Z' }]);
  fetchWins.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('useSellerLiveClaim', () => {
  it('suscribe, queda en línea y relee el estado al conectar', async () => {
    const { result } = renderHook(() => useSellerLiveClaim(snapshot));
    expect(result.current.state.connection).toBe('connecting');
    act(() => current().handlers.onStatus('subscribed'));
    await flush();
    expect(result.current.state.connection).toBe('online');
    expect(fetchState).toHaveBeenCalledTimes(1);
  });

  it('aplica intentos de Realtime y resuelve el nombre del comprador una sola vez', async () => {
    const { result } = renderHook(() => useSellerLiveClaim(snapshot));
    act(() => {
      current().handlers.onEntry(consoleEntry({ id: 'e1', seq: 1 }));
      current().handlers.onEntry(consoleEntry({ id: 'e2', seq: 2 }));
    });
    await flush();
    expect(result.current.state.entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(fetchBuyers).toHaveBeenCalledTimes(1);
    expect(result.current.state.buyers['buyer-1']?.name).toBe('Luis');
  });

  it('con un corte reintenta con backoff y al volver iguala al servidor', async () => {
    const { result } = renderHook(() => useSellerLiveClaim(snapshot));
    act(() => current().handlers.onStatus('subscribed'));
    await flush();
    fetchState.mockClear();

    act(() => current().handlers.onStatus('error'));
    expect(result.current.state.connection).toBe('reconnecting');
    fetchState.mockResolvedValue({
      type: 'snapshot',
      session: snapshot.session,
      items: [item({ id: 'a', status: 'sold', updated_at: '2026-10-26T10:09:00.000Z' })],
      feed: [feedEvent(1), feedEvent(2)],
      entries: [consoleEntry({ id: 'e1', status: 'accepted' })],
    });
    await act(async () => void (await vi.advanceTimersByTimeAsync(1_001)));
    expect(channels).toHaveLength(2);
    act(() => current().handlers.onStatus('subscribed'));
    await flush();
    expect(result.current.state.connection).toBe('online');
    expect(result.current.state.items[0]?.status).toBe('sold');
    expect(result.current.state.feed.map((e) => e.id)).toEqual([1, 2]);
    expect(result.current.state.entries[0]?.status).toBe('accepted');
  });

  it('al terminar el evento lee los claims ganados', async () => {
    const { result } = renderHook(() => useSellerLiveClaim(snapshot));
    fetchWins.mockResolvedValue([
      { id: 'w', item_id: 'a', buyer_id: 'buyer-1', price_cents: 100, won_via: 'claim' },
    ]);
    act(() =>
      current().handlers.onSession(
        session({ status: 'ended', updated_at: '2026-10-26T11:00:00.000Z' }),
      ),
    );
    await flush();
    expect(fetchWins).toHaveBeenCalledWith('session-1');
    expect(result.current.wins).toHaveLength(1);
  });

  it('un claim del feed dispara una relectura aunque claim_entries no llegue por Realtime', async () => {
    renderHook(() => useSellerLiveClaim(snapshot));
    fetchState.mockClear();
    act(() => current().handlers.onFeed(feedEvent(5, { type: 'item_claimed' })));
    act(() => current().handlers.onFeed(feedEvent(6, { type: 'item_offer' })));
    await act(async () => void (await vi.advanceTimersByTimeAsync(300)));
    expect(fetchState).toHaveBeenCalledTimes(1); // las dos señales se funden en una lectura
  });

  it('cierra el canal al desmontar', () => {
    const { unmount } = renderHook(() => useSellerLiveClaim(snapshot));
    unmount();
    expect(current().unsubscribe).toHaveBeenCalled();
  });
});
