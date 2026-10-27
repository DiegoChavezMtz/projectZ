import type { ClaimItem, SessionFeedEvent } from '@/types/claims';

/** Máximo de eventos del feed que el cliente conserva en memoria. */
export const FEED_MEMORY_LIMIT = 200;

const time = (iso: string) => Date.parse(iso);

/**
 * Une dos listas de artículos quedándose, por id, con la versión de `updated_at` más reciente.
 * Ante un empate gana la que llega después: `set_updated_at()` usa `now()` (inicio de la transacción),
 * así que varias actualizaciones de una misma RPC (p. ej. líder y luego vendida con `auto_confirm`)
 * comparten marca, y Realtime las entrega en orden de commit. Nadie ve estados intermedios de una
 * transacción, así que un empate nunca es una versión más vieja.
 */
export function mergeItems(current: ClaimItem[], incoming: ClaimItem[]): ClaimItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const known = byId.get(item.id);
    if (!known || time(item.updated_at) >= time(known.updated_at)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.position - b.position);
}

/** Dedupe por `id`, orden ascendente por `id` y tope en memoria (se conservan los más recientes). */
export function mergeFeed(
  current: SessionFeedEvent[],
  incoming: SessionFeedEvent[],
): SessionFeedEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  return sorted.length > FEED_MEMORY_LIMIT ? sorted.slice(-FEED_MEMORY_LIMIT) : sorted;
}

/** ¿`incoming` es una versión igual o más nueva que `current`? (mismo criterio que `mergeItems`). */
export const isNewerOrEqual = (incoming: string, current: string) =>
  time(incoming) >= time(current);
