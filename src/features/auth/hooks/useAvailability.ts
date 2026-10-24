'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export type Availability = 'idle' | 'checking' | 'available' | 'taken';

/**
 * Validación en vivo: espera a que la persona deje de escribir y pregunta `check`. Nada se consulta si el valor
 * no pasó la validación local (`valid`) o es el que ya tiene (`current`). Las respuestas viejas se descartan.
 */
export function useAvailability(
  value: string,
  options: { valid: boolean; current?: string; check: (value: string) => Promise<boolean> },
): Availability {
  const { valid, current, check } = options;
  const debounced = useDebounce(value, 400);
  const [result, setResult] = useState<{ value: string; available: boolean } | null>(null);

  const skip = !valid || value === current;
  const settled = debounced === value;

  useEffect(() => {
    if (skip || !settled) return;
    let cancelled = false;
    check(debounced)
      .then((available) => {
        if (!cancelled) setResult({ value: debounced, available });
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, settled, skip, check]);

  if (skip) return 'idle';
  if (!settled || result?.value !== value) return 'checking';
  return result.available ? 'available' : 'taken';
}
