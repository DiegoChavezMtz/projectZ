import 'server-only';
import { cache } from 'react';
import { snapshotService } from '../../services/snapshot.service';

/** Usuario y snapshot de la petición en curso; `cache` evita leerlos dos veces (metadatos y página). */
export const loadLive = cache(async (code: string) => {
  const viewer = await snapshotService.getViewer();
  const snapshot = await snapshotService.getSnapshot(code, viewer?.id ?? null);
  return { viewer, snapshot };
});
