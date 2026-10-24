'use client';

import { useEffect, useState } from 'react';

/** Devuelve `value` tras `delayMs` sin cambios (validaciones en vivo, búsquedas). */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
