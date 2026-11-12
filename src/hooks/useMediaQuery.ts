'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Coincidencia con una media query; falso en el servidor (React reconcilia sin avisos al hidratar). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
