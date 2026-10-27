'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useResilientChannel } from '@/hooks/useResilientChannel';
import { consoleDataClient } from '../services/consoleData.client';
import { consoleRealtimeService } from '../services/consoleRealtime.service';
import type { ConsoleSnapshot, ConsoleWin } from '../types';
import { consoleReducer, createConsoleState } from '../utils/consoleReducer';

const REFRESH_DEBOUNCE_MS = 250;

/**
 * Eventos del feed tras los cuales cambian los intentos. Además de `claim_entries` por Realtime, el
 * feed (siempre publicado) dispara una relectura: la consola no depende de un solo canal.
 */
const ENTRY_EVENTS = new Set([
  'item_claimed',
  'item_offer',
  'item_sold',
  'entry_rejected',
  'item_withdrawn',
]);

/**
 * Estado en vivo de la consola: snapshot SSR + `postgres_changes` de artículos, intentos, feed y
 * evento. Reutiliza `useResilientChannel` (backoff y offline/online) y `mergeItems`/`mergeFeed`
 * del visor. Tras conectar o reconectar relee el estado, así que no pierde nada en un corte.
 */
export function useSellerLiveClaim(snapshot: ConsoleSnapshot) {
  const sessionId = snapshot.session.id;
  const [state, dispatch] = useReducer(consoleReducer, snapshot, createConsoleState);
  const [wins, setWins] = useState<ConsoleWin[]>(snapshot.wins);
  const known = useRef(new Set(snapshot.buyers.map((buyer) => buyer.id)));
  const lastStatus = useRef(snapshot.session.status);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveBuyers = useCallback(async (buyerIds: string[]) => {
    const missing = [...new Set(buyerIds)].filter((id) => !known.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => known.current.add(id));
    try {
      dispatch({ type: 'buyers', buyers: await consoleDataClient.fetchBuyers(missing) });
    } catch {
      missing.forEach((id) => known.current.delete(id)); // se reintenta con el siguiente evento
    }
  }, []);

  /** Relee todo el estado del evento. Se llama al (re)conectar y tras cada acción del vendedor. */
  const refresh = useCallback(async () => {
    try {
      const fresh = await consoleDataClient.fetchState(sessionId);
      dispatch(fresh);
      await resolveBuyers(fresh.entries.map((entry) => entry.buyer_id));
    } catch {
      // Sin red: el banner de conexión ya lo comunica.
    }
  }, [sessionId, resolveBuyers]);

  /** Varias señales seguidas (acción + eventos) se funden en una sola lectura. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useResilientChannel({
    channelKey: sessionId,
    subscribe: (onStatus) =>
      consoleRealtimeService.subscribe(sessionId, {
        onItem: (item) => dispatch({ type: 'item', item }),
        onFeed: (event) => {
          dispatch({ type: 'feed', event });
          if (ENTRY_EVENTS.has(event.type)) scheduleRefresh();
        },
        onSession: (session) => dispatch({ type: 'session', session }),
        onEntry: (entry) => {
          dispatch({ type: 'entry', entry });
          void resolveBuyers([entry.buyer_id]);
        },
        onStatus,
      }),
    onConnection: (status) => dispatch({ type: 'connection', status }),
    onSubscribed: () => void refresh(),
  });

  // Al terminar el evento se leen los claims ganados para el resumen.
  const status = state.session.status;
  useEffect(() => {
    if (status === 'ended' && lastStatus.current !== 'ended') {
      void consoleDataClient
        .fetchWins(sessionId)
        .then((rows) => {
          setWins(rows);
          return resolveBuyers(rows.map((win) => win.buyer_id));
        })
        .catch(() => undefined);
    }
    lastStatus.current = status;
  }, [status, sessionId, resolveBuyers]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  return { state, dispatch, wins, refresh, scheduleRefresh };
}
