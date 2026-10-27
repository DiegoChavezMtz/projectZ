'use client';

import { useEffect, useRef } from 'react';
import { backoffDelay } from '@/utils/backoff';

export type ChannelStatus = 'subscribed' | 'error' | 'closed';
export type ChannelConnection = 'connecting' | 'online' | 'reconnecting' | 'offline';

type Options = {
  /** Cambia cuando hay que abrir otro canal (p. ej. el id del evento). */
  channelKey: string;
  /** Abre el canal y devuelve cómo cerrarlo. Debe avisar el estado con `onStatus`. */
  subscribe: (onStatus: (status: ChannelStatus) => void) => () => void;
  onConnection: (status: ChannelConnection) => void;
  /** Cada vez que el canal queda suscrito (primera vez y reconexiones): releer el estado. */
  onSubscribed: () => void;
};

/**
 * Ciclo de vida de un canal Realtime: conecta, reintenta con backoff exponencial si falla y se
 * cierra/reabre con `offline`/`online` del navegador. No sabe de dominio: el canal y el refetch
 * los inyecta quien lo usa (visor y consola comparten esta lógica).
 */
export function useResilientChannel({
  channelKey,
  subscribe,
  onConnection,
  onSubscribed,
}: Options) {
  const latest = useRef({ subscribe, onConnection, onSubscribed });
  useEffect(() => {
    latest.current = { subscribe, onConnection, onSubscribed };
  });

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let attempt = 0;
    let unsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const connection = (status: ChannelConnection) => {
      if (!disposed) latest.current.onConnection(status);
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
      connection(attempt === 0 ? 'connecting' : 'reconnecting');
      unsubscribe = latest.current.subscribe((status) => {
        if (mine !== generation) return; // canal viejo
        if (status === 'subscribed') {
          attempt = 0;
          connection('online');
          if (!disposed) latest.current.onSubscribed(); // cubre el hueco entre el snapshot y la suscripción
        } else {
          connection('reconnecting');
          scheduleRetry();
        }
      });
    }

    const onOffline = () => {
      teardown();
      connection('offline');
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
    };
  }, [channelKey]);
}
