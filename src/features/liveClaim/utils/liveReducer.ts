import type { ClaimItem, SessionFeedEvent } from '@/types/claims';
import { isNewerOrEqual, mergeFeed, mergeItems } from '@/utils/liveMerge';
import type { LiveAction, LiveState, ViewerEntry } from '../types';

export { mergeFeed };

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
        session: isNewerOrEqual(action.session.updated_at, state.session.updated_at)
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
      return isNewerOrEqual(action.session.updated_at, state.session.updated_at)
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
