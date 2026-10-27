'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { liveDataClient } from '../services/liveData.client';
import { liveRealtimeService } from '../services/liveRealtime.service';
import type { LiveAction, LiveSnapshot, Viewer, ViewerEntry } from '../types';
import { backoffDelay } from '../utils/backoff';
import { createInitialState, liveReducer } from '../utils/liveReducer';

const ENTRIES_REFRESH_MS = 300;

/** Eventos del feed tras los cuales pueden haber cambiado los intentos propios. */
const ENTRY_EVENTS = new Set(['item_sold', 'entry_rejected', 'item_withdrawn', 'session_ended']);

/**
 * Estado en vivo del evento: snapshot inicial + `postgres_changes` (artículos, feed, evento).
 * Tras (re)conectar se vuelve a leer el estado; si el canal falla se reintenta con backoff.
 */
export function useLiveClaim(
  snapshot: LiveSnapshot,
  viewer: Viewer,
  initialEntries: ViewerEntry[] = [],
) {
  const sessionId = snapshot.session.id;
  const viewerId = viewer?.id ?? null;
  const [state, dispatch] = useReducer(
    liveReducer,
    snapshot,
    (initial) =>
      createInitialState({
        session: initial.session,
        items: initial.items,
        feed: initial.feed,
        entries: initialEntries,
      }),
  );
  const entriesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshEntries = useCallback(async () => {
    if (!viewerId) return;
    try {
      dispatch({ type: 'entries', entries: await liveDataClient.fetchMyEntries(sessionId, viewerId) });
    } catch {
      // Se reintenta con el siguiente evento o reconexión.
    }
  }, [sessionId, viewerId]);

  const scheduleEntries = useCallback(() => {
    if (!viewerId) return;
    if (entriesTimer.current) clearTimeout(entriesTimer.current);
    entriesTimer.current = setTimeout(() => void refreshEntries(), ENTRIES_REFRESH_MS);
  }, [viewerId, refreshEntries]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await liveDataClient.fetchState(sessionId);
      dispatch({ type: 'snapshot', ...fresh });
      await refreshEntries();
    } catch {
      // Sin red: el banner de conexión ya lo comunica.
    }
  }, [sessionId, refreshEntries]);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let attempt = 0;
    let unsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const send = (action: LiveAction) => {
      if (!disposed) dispatch(action);
    };

    const teardown = () => {
      generation += 1;
      unsubscribe?.();
      unsubscribe = null;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      unsubscribe?.();
      unsubscribe = null;
      const delay = backoffDelay(attempt);
      attempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    function connect() {
      const mine = (generation += 1);
      send({ type: 'connection', status: attempt === 0 ? 'connecting' : 'reconnecting' });
      unsubscribe = liveRealtimeService.subscribe(sessionId, {
        onItem: (item) => send({ type: 'item', item }),
        onFeed: (event) => {
          send({ type: 'feed', event });
          if (ENTRY_EVENTS.has(event.type)) scheduleEntries();
        },
        onSession: (session) => {
          send({ type: 'session', session });
          if (session.status === 'ended') scheduleEntries();
        },
        onStatus: (status) => {
          if (mine !== generation) return; // canal viejo
          if (status === 'subscribed') {
            attempt = 0;
            send({ type: 'connection', status: 'online' });
            void refresh(); // cubre el hueco entre el snapshot y la suscripción, y las reconexiones
          } else {
            send({ type: 'connection', status: 'reconnecting' });
            scheduleRetry();
          }
        },
      });
    }

    const onOffline = () => {
      teardown();
      send({ type: 'connection', status: 'offline' });
    };
    const onOnline = () => {
      teardown();
      attempt = 0;
      connect();
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) onOffline();
    else connect();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      teardown();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (entriesTimer.current) clearTimeout(entriesTimer.current);
    };
  }, [sessionId, refresh, scheduleEntries]);

  return { state, dispatch, refresh, refreshEntries };
}
