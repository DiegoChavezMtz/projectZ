'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useResilientChannel } from '@/hooks/useResilientChannel';
import { liveDataClient } from '../services/liveData.client';
import { liveRealtimeService } from '../services/liveRealtime.service';
import type { LiveSnapshot, Viewer, ViewerEntry } from '../types';
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
  const [state, dispatch] = useReducer(liveReducer, snapshot, (initial) =>
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
      dispatch({
        type: 'entries',
        entries: await liveDataClient.fetchMyEntries(sessionId, viewerId),
      });
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

  useResilientChannel({
    channelKey: sessionId,
    subscribe: (onStatus) =>
      liveRealtimeService.subscribe(sessionId, {
        onItem: (item) => dispatch({ type: 'item', item }),
        onFeed: (event) => {
          dispatch({ type: 'feed', event });
          if (ENTRY_EVENTS.has(event.type)) scheduleEntries();
        },
        onSession: (session) => {
          dispatch({ type: 'session', session });
          if (session.status === 'ended') scheduleEntries();
        },
        onStatus,
      }),
    onConnection: (status) => dispatch({ type: 'connection', status }),
    onSubscribed: () => void refresh(),
  });

  useEffect(
    () => () => {
      if (entriesTimer.current) clearTimeout(entriesTimer.current);
    },
    [],
  );

  return { state, dispatch, refresh, refreshEntries };
}
