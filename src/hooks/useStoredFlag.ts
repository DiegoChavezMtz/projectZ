'use client';

import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'zl:stored-flag';
// Respaldo en memoria cuando el almacenamiento está bloqueado (modo privado).
const memory = new Map<string, boolean>();

/** Preferencia booleana por navegador (localStorage), sincronizada entre pestañas. Falso en el servidor. */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      window.addEventListener('storage', onStorage);
      window.addEventListener(EVENT, notify);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(EVENT, notify);
      };
    },
    [key],
  );
  const read = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? (memory.get(key) ?? false) : stored === '1';
    } catch {
      return memory.get(key) ?? false;
    }
  }, [key]);
  const value = useSyncExternalStore(subscribe, read, () => false);
  const write = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // Sin almacenamiento: la preferencia vale solo para esta visita.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, write];
}
