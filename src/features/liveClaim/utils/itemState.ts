import type { ClaimItem, SessionStatus } from '@/types/claims';
import type { ItemView, PendingAction, PublicItemState, ViewerEntry, ViewerRelation } from '../types';

const OPEN_ENTRY_STATUSES: ViewerEntry['status'][] = ['queued', 'pending'];

/** Estado público del artículo: igual para todos los espectadores. */
export function publicItemState(item: ClaimItem): PublicItemState {
  switch (item.status) {
    case 'hidden':
      return 'upcoming';
    case 'sold':
      return 'sold';
    case 'withdrawn':
      return 'withdrawn';
    case 'available':
      if (item.leader_entry_id) return 'claimed';
      return item.offer_count > 0 ? 'offers' : 'available';
  }
}

/** Intento propio abierto (en fila o con oferta pendiente) sobre el artículo. */
export function openEntryFor(itemId: string, entries: ViewerEntry[]): ViewerEntry | null {
  const open = entries.filter(
    (entry) => entry.item_id === itemId && OPEN_ENTRY_STATUSES.includes(entry.status),
  );
  // Un claim pesa más que una oferta; entre iguales, el más antiguo.
  open.sort((a, b) => (a.kind === b.kind ? a.seq - b.seq : a.kind === 'claim' ? -1 : 1));
  return open[0] ?? null;
}

function relationFor(
  item: ClaimItem,
  viewerId: string | null,
  entries: ViewerEntry[],
  pending: PendingAction | undefined,
): { relation: ViewerRelation; openEntry: ViewerEntry | null } {
  const openEntry = openEntryFor(item.id, entries);
  if (!viewerId) return { relation: 'none', openEntry: null };

  const mine = entries.filter((entry) => entry.item_id === item.id);
  if (item.status === 'sold') {
    if (item.leader_user_id === viewerId || mine.some((e) => e.status === 'accepted'))
      return { relation: 'won', openEntry: null };
    return { relation: mine.length > 0 ? 'lost' : 'none', openEntry: null };
  }
  if (pending) return { relation: 'sending', openEntry };
  if (openEntry?.kind === 'offer') return { relation: 'offered', openEntry };
  if (openEntry) {
    return {
      relation: item.leader_user_id === viewerId ? 'leading' : 'queued',
      openEntry,
    };
  }
  return { relation: 'none', openEntry: null };
}

/**
 * Deriva lo que ve el espectador de un artículo (estado público, relación propia y acciones
 * permitidas). Las acciones solo existen con el evento `live`; el vendedor del evento no compra.
 */
export function deriveItemView(input: {
  item: ClaimItem;
  sessionStatus: SessionStatus;
  viewerId: string | null;
  isOwner: boolean;
  entries: ViewerEntry[];
  pending?: PendingAction;
}): ItemView {
  const { item, sessionStatus, viewerId, isOwner, entries, pending } = input;
  const state = publicItemState(item);
  const { relation, openEntry } = relationFor(item, viewerId, entries, pending);

  const open = sessionStatus === 'live' && !isOwner && (state === 'available' || state === 'claimed' || state === 'offers');
  const busy = relation === 'sending';
  return {
    state,
    relation,
    openEntry,
    // Quien ya tiene un intento abierto no repite; un claim se puede pedir con una oferta abierta.
    canClaim: open && !busy && relation !== 'leading' && relation !== 'queued',
    canOffer: open && !busy && relation !== 'offered',
  };
}
