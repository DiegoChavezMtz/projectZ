'use client';

import { useCallback, useEffect, useState } from 'react';

/** Cuenta regresiva en segundos (para el reenvío de códigos). `start(n)` la reinicia. */
export function useCooldown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(Math.max(0, seconds)), []);
  return { remaining, start };
}
