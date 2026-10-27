import type { ClaimItem, SessionFeedEvent } from '@/types/claims';
import { FEED_MEMORY_LIMIT, type LiveAction, type LiveState, type ViewerEntry } from '../types';

const time = (iso: string) => Date.parse(iso);

/**
 * Une dos listas de artículos quedándose, por id, con la versión de `updated_at` más reciente.
 * Ante un empate gana la que llega después: `set_updated_at()` usa `now()` (inicio de la transacción),
 * así que varias actualizaciones de una misma RPC (p. ej. líder y luego vendida con `auto_confirm`)
 * comparten marca, y Realtime las entrega en orden de commit. Nadie ve estados intermedios de una
 * transacción, así que un empate nunca es una versión más vieja.
 */
function mergeItems(current: ClaimItem[], incoming: ClaimItem[]): ClaimItem[] {
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

export function createInitialState(input: {
  session: LiveState['session'];
  items: ClaimItem[];
  feed: SessionFeedEvent[];
  entries?: ViewerEntry[];
}): LiveState {
  return {
    session: input.session,
    items: [...input.items].sort((a, b) => a.position - b.position),
    feed: mergeFeed([], input.feed),
    connection: 'connecting',
    entries: input.entries ?? [],
    pending: {},
  };
}

const without = <T extends object>(record: Record<string, T>, key: string) => {
  const { [key]: _removed, ...rest } = record;
  void _removed;
  return rest;
};

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'snapshot':
      return {
        ...state,
        session:
          time(action.session.updated_at) >= time(state.session.updated_at)
            ? action.session
            : state.session,
        // El snapshot es la lista autoritativa de lo visible: lo que ya no viene se quita.
        items: mergeItems(
          state.items.filter((item) => action.items.some((next) => next.id === item.id)),
          action.items,
        ),
        feed: mergeFeed(state.feed, action.feed),
      };
    case 'item':
      return { ...state, items: mergeItems(state.items, [action.item]) };
    case 'feed':
      return { ...state, feed: mergeFeed(state.feed, [action.event]) };
    case 'session':
      return time(action.session.updated_at) >= time(state.session.updated_at)
        ? { ...state, session: action.session }
        : state;
    case 'connection':
      return state.connection === action.status ? state : { ...state, connection: action.status };
    case 'entries':
      return { ...state, entries: action.entries };
    case 'pendingStart':
      return { ...state, pending: { ...state.pending, [action.itemId]: action.action } };
    case 'pendingDone':
      return {
        ...state,
        pending: without(state.pending, action.itemId),
        entries: action.entry
          ? [...state.entries.filter((entry) => entry.id !== action.entry?.id), action.entry]
          : state.entries,
      };
    case 'pendingFail':
      return { ...state, pending: without(state.pending, action.itemId) };
    case 'entryWithdrawn':
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.entryId ? { ...entry, status: 'withdrawn' } : entry,
        ),
      };
  }
}
