import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RealtimeHandlers,
  RealtimeStatus,
} from '@/features/liveClaim/services/liveRealtime.service';
import type { LiveSnapshot } from '@/features/liveClaim/types';
import { feedEvent, item, session } from './factories';

// S6-02 / S6-09: el hook con Realtime simulado. Un corte (canal con error) pasa a "reconectando",
// reintenta con backoff y, al reconectar, vuelve a leer el estado del servidor.
const channels: { handlers: RealtimeHandlers; unsubscribe: ReturnType<typeof vi.fn> }[] = [];
const fetchState = vi.fn();
const fetchMyEntries = vi.fn();

vi.mock('@/features/liveClaim/services/liveRealtime.service', () => ({
  liveRealtimeService: {
    subscribe: (_id: string, handlers: RealtimeHandlers) => {
      const unsubscribe = vi.fn();
      channels.push({ handlers, unsubscribe });
      return unsubscribe;
    },
  },
}));
vi.mock('@/features/liveClaim/services/liveData.client', () => ({
  liveDataClient: {
    fetchState: (...args: unknown[]) => fetchState(...args),
    fetchMyEntries: (...args: unknown[]) => fetchMyEntries(...args),
  },
}));

const { useLiveClaim } = await import('@/features/liveClaim/hooks/useLiveClaim');

const snapshot: LiveSnapshot = {
  session: session({ status: 'live', updated_at: '2026-10-26T10:00:00.000Z' }),
  items: [item({ id: 'a' })],
  feed: [feedEvent(1)],
  serverNow: '2026-10-26T10:00:00.000Z',
  seller: { id: 'seller-1', shopName: 'Tienda', handle: null, city: null, badge: null },
};
const current = () => channels.at(-1)!;
const status = (s: RealtimeStatus) => act(() => current().handlers.onStatus(s));

beforeEach(() => {
  vi.useFakeTimers();
  channels.length = 0;
  fetchState
    .mockReset()
    .mockResolvedValue({ session: snapshot.session, items: snapshot.items, feed: snapshot.feed });
  fetchMyEntries.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('useLiveClaim', () => {
  it('suscribe al montar, queda en línea y relee el estado al conectar', async () => {
    const { result } = renderHook(() => useLiveClaim(snapshot, null));
    expect(channels).toHaveLength(1);
    expect(result.current.state.connection).toBe('connecting');
    status('subscribed');
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(result.current.state.connection).toBe('online');
    expect(fetchState).toHaveBeenCalledTimes(1);
  });

  it('aplica los cambios de Realtime sin duplicar ni retroceder', () => {
    const { result } = renderHook(() => useLiveClaim(snapshot, null));
    act(() => {
      current().handlers.onItem(
        item({ id: 'a', status: 'sold', updated_at: '2026-10-26T10:05:00.000Z' }),
      );
      current().handlers.onItem(
        item({ id: 'a', status: 'available', updated_at: '2026-10-26T10:01:00.000Z' }),
      );
      current().handlers.onFeed(feedEvent(3));
      current().handlers.onFeed(feedEvent(2));
      current().handlers.onFeed(feedEvent(3));
    });
    expect(result.current.state.items[0]?.status).toBe('sold');
    expect(result.current.state.feed.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('con un corte: reconectando, reintento con backoff y estado igual al del servidor al volver', async () => {
    const { result } = renderHook(() => useLiveClaim(snapshot, null));
    status('subscribed');
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    fetchState.mockClear();

    // Se corta el canal.
    status('error');
    expect(result.current.state.connection).toBe('reconnecting');
    expect(channels).toHaveLength(1);

    // Mientras estuvo caído el servidor siguió avanzando.
    const serverItem = item({
      id: 'a',
      status: 'sold',
      leader_display_name: 'Luis',
      updated_at: '2026-10-26T10:09:00.000Z',
    });
    fetchState.mockResolvedValue({
      session: session({ status: 'live', updated_at: '2026-10-26T10:09:00.000Z' }),
      items: [serverItem],
      feed: [feedEvent(1), feedEvent(2), feedEvent(3)],
    });

    // Primer reintento a 1 s (backoff).
    await act(async () => void (await vi.advanceTimersByTimeAsync(999)));
    expect(channels).toHaveLength(1);
    await act(async () => void (await vi.advanceTimersByTimeAsync(2)));
    expect(channels).toHaveLength(2);
    expect(channels[0]!.unsubscribe).toHaveBeenCalled();

    // El segundo intento falla también: espera 2 s.
    status('error');
    await act(async () => void (await vi.advanceTimersByTimeAsync(2_001)));
    expect(channels).toHaveLength(3);

    // Reconecta: relee y el estado coincide con el servidor.
    status('subscribed');
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(result.current.state.connection).toBe('online');
    expect(fetchState).toHaveBeenCalled();
    expect(result.current.state.items[0]).toMatchObject({
      status: 'sold',
      leader_display_name: 'Luis',
    });
    expect(result.current.state.feed.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('sin red del navegador: "sin conexión" y, al volver, reconecta de inmediato', async () => {
    const { result } = renderHook(() => useLiveClaim(snapshot, null));
    status('subscribed');
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));

    act(() => void window.dispatchEvent(new Event('offline')));
    expect(result.current.state.connection).toBe('offline');
    expect(channels[0]!.unsubscribe).toHaveBeenCalled();

    const before = channels.length;
    act(() => void window.dispatchEvent(new Event('online')));
    expect(channels.length).toBe(before + 1);
    expect(result.current.state.connection).toBe('connecting');
  });

  it('al desmontar se cierra el canal y no quedan reintentos', async () => {
    const { unmount } = renderHook(() => useLiveClaim(snapshot, null));
    status('error');
    unmount();
    expect(channels[0]!.unsubscribe).toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(60_000)));
    expect(channels).toHaveLength(1);
  });

  it('con sesión, relee los intentos propios tras un evento que los puede cambiar', async () => {
    renderHook(() => useLiveClaim(snapshot, { id: 'me' }));
    act(() => current().handlers.onFeed(feedEvent(5, { type: 'item_sold' })));
    await act(async () => void (await vi.advanceTimersByTimeAsync(400)));
    expect(fetchMyEntries).toHaveBeenCalledWith('session-1', 'me');
  });
});
