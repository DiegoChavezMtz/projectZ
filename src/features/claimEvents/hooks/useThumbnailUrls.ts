'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * URLs de objeto para las miniaturas de la sesión. Cada URL se crea una sola vez por captura y se revoca en
 * cuanto la captura sale de la lista o el componente se desmonta (60 piezas sin fugas de memoria).
 */
export function useThumbnailUrls(
  ids: readonly string[],
  loadBlob: (id: string) => Promise<Blob | undefined>,
): Record<string, string> {
  const urls = useRef(new Map<string, string>());
  const [, setVersion] = useState(0);
  const key = ids.join('|');

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(ids);
    for (const [id, url] of urls.current)
      if (!wanted.has(id)) {
        URL.revokeObjectURL(url);
        urls.current.delete(id);
      }
    const missing = ids.filter((id) => !urls.current.has(id));
    void Promise.all(
      missing.map(async (id) => {
        const blob = await loadBlob(id);
        if (!blob || cancelled || urls.current.has(id)) return;
        urls.current.set(id, URL.createObjectURL(blob));
      }),
    ).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
    // `key` resume `ids`; `loadBlob` es estable por diseño (método de la cola).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const map = urls.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  return Object.fromEntries(urls.current);
}
