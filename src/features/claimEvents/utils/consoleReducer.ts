import { isNewerOrEqual, mergeFeed, mergeItems } from '@/utils/liveMerge';
import type {
  BuyerInfo,
  ConsoleAction,
  ConsoleEntry,
  ConsoleSnapshot,
  ConsoleState,
} from '../types';

function omitKey(busy: ConsoleState['busy'], key: string): ConsoleState['busy'] {
  const { [key]: _removed, ...rest } = busy;
  void _removed;
  return rest;
}

const OPEN: ConsoleEntry['status'][] = ['queued', 'pending'];

/** Un intento abierto puede cerrarse, pero uno cerrado no vuelve a abrirse: protege de lecturas viejas. */
const isOpen = (entry: ConsoleEntry) => OPEN.includes(entry.status);

/**
 * Une dos listas de intentos por `id`. Gana la versión ya resuelta; entre dos abiertas o dos
 * resueltas, la que llega después (el estado `accepted` o `superseded` no se vuelve `queued`).
 */
export function mergeEntries(current: ConsoleEntry[], incoming: ConsoleEntry[]): ConsoleEntry[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const known = byId.get(entry.id);
    if (!known || !(isOpen(entry) && !isOpen(known))) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

const indexBuyers = (buyers: BuyerInfo[]) => Object.fromEntries(buyers.map((b) => [b.id, b]));

export function createConsoleState(snapshot: ConsoleSnapshot): ConsoleState {
  return {
    session: snapshot.session,
    items: [...snapshot.items].sort((a, b) => a.position - b.position),
    feed: mergeFeed([], snapshot.feed),
    entries: mergeEntries([], snapshot.entries),
    buyers: indexBuyers(snapshot.buyers),
    connection: 'connecting',
    busy: {},
  };
}

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case 'snapshot':
      return {
        ...state,
        session: isNewerOrEqual(action.session.updated_at, state.session.updated_at)
          ? action.session
          : state.session,
        items: mergeItems(state.items, action.items),
        feed: mergeFeed(state.feed, action.feed),
        // La lectura es autoritativa: también deshace cualquier cambio optimista que el motor rechazó.
        entries: mergeEntries([], action.entries),
        buyers: action.buyers ? { ...state.buyers, ...indexBuyers(action.buyers) } : state.buyers,
      };
    case 'item':
      return { ...state, items: mergeItems(state.items, [action.item]) };
    case 'feed':
      return { ...state, feed: mergeFeed(state.feed, [action.event]) };
    case 'session':
      return isNewerOrEqual(action.session.updated_at, state.session.updated_at)
        ? { ...state, session: action.session }
        : state;
    case 'entry':
      return { ...state, entries: mergeEntries(state.entries, [action.entry]) };
    case 'buyers':
      return { ...state, buyers: { ...state.buyers, ...indexBuyers(action.buyers) } };
    case 'connection':
      return state.connection === action.status ? state : { ...state, connection: action.status };
    case 'entryStatus':
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.entryId ? { ...entry, status: action.status } : entry,
        ),
      };
    case 'busyStart':
      return { ...state, busy: { ...state.busy, [action.key]: true } };
    case 'busyDone':
      return { ...state, busy: omitKey(state.busy, action.key) };
  }
}
