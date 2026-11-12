import type { BadgeData } from '@/types/reputation';
import type { ClaimItem, ClaimSession, SessionFeedEvent } from '@/types/claims';
import type { Database } from '@/types/database.types';

/** Estado serializable que devuelven las Server Actions a `useActionState`. */
export type ActionState = {
  status: 'idle' | 'error' | 'success';
  /** Código estable de error (mapeable a texto de UI). */
  code?: string;
  /** Errores por campo. */
  fieldErrors?: Partial<Record<string, string>>;
  /** Motivos por los que un evento no se puede publicar (`publish_session`). */
  reasons?: string[];
  /** Código público (`/c/[code]`) tras publicar. */
  publicCode?: string;
};

export const initialActionState: ActionState = { status: 'idle' };

/** Motivos que devuelve `publish_session` y que `canPublish` replica en el cliente. */
export type PublishReason =
  'no_items' | 'items_missing_image' | 'items_missing_price' | 'starts_at_not_future';

export type SessionListItem = ClaimSession & { item_count: number };
export type SessionWithItems = ClaimSession & { items: ClaimItem[] };

/** Filtros de la lista del vendedor. */
export type SessionListFilter = 'all' | ClaimSession['status'];

// --- Consola del vendedor en vivo (S7) -----------------------------------------------------------

type EntryRow = Database['public']['Tables']['claim_entries']['Row'];

/** Intento (claim u oferta) sobre un artículo del evento. El vendedor los lee todos por RLS. */
export type ConsoleEntry = Pick<
  EntryRow,
  | 'id'
  | 'item_id'
  | 'session_id'
  | 'buyer_id'
  | 'kind'
  | 'amount_cents'
  | 'status'
  | 'seq'
  | 'created_at'
  | 'resolved_at'
>;

/** Comprador tal como lo ve el vendedor: nombre público y desde cuándo tiene cuenta. */
export type BuyerInfo = {
  id: string;
  name: string;
  memberSince: string;
  /** Insignia de reputación (misma consulta que el perfil público del comprador). */
  badge?: BadgeData | null;
};

export type ConsoleConnection = 'connecting' | 'online' | 'reconnecting' | 'offline';

/** Claim ganado, para el resumen del cierre. */
export type ConsoleWin = {
  id: string;
  item_id: string;
  buyer_id: string;
  price_cents: number;
  won_via: Database['public']['Enums']['entry_kind'];
};

/** Lo que el server component entrega a `useSellerLiveClaim`. */
export type ConsoleSnapshot = {
  session: ClaimSession;
  items: ClaimItem[];
  feed: SessionFeedEvent[];
  entries: ConsoleEntry[];
  buyers: BuyerInfo[];
  wins: ConsoleWin[];
  /** Hora del servidor (ISO UTC) al armar el snapshot. */
  serverNow: string;
};

export type ConsoleState = {
  session: ClaimSession;
  items: ClaimItem[];
  feed: SessionFeedEvent[];
  entries: ConsoleEntry[];
  buyers: Record<string, BuyerInfo>;
  connection: ConsoleConnection;
  /** Claves (`item:<id>`, `entry:<id>`, `session`) con una acción en curso. */
  busy: Record<string, true>;
};

export type ConsoleAction =
  | {
      type: 'snapshot';
      session: ClaimSession;
      items: ClaimItem[];
      feed: SessionFeedEvent[];
      entries: ConsoleEntry[];
      buyers?: BuyerInfo[];
    }
  | { type: 'item'; item: ClaimItem }
  | { type: 'feed'; event: SessionFeedEvent }
  | { type: 'session'; session: ClaimSession }
  | { type: 'entry'; entry: ConsoleEntry }
  | { type: 'buyers'; buyers: BuyerInfo[] }
  | { type: 'connection'; status: ConsoleConnection }
  | { type: 'entryStatus'; entryId: string; status: ConsoleEntry['status'] }
  | { type: 'busyStart'; key: string }
  | { type: 'busyDone'; key: string };

/** Fila de la cola de un artículo, ya con el comprador resuelto. */
export type QueueRow = {
  entry: ConsoleEntry;
  buyerName: string;
  memberSince: string | null;
  badge: BadgeData | null;
  isLeader: boolean;
};

export type ItemOperation = {
  item: ClaimItem;
  /** Claims abiertos en orden de llegada (`seq`); el primero es el líder. */
  queue: QueueRow[];
  /** Ofertas pendientes, de mayor a menor monto (empate: la más antigua). */
  offers: QueueRow[];
  /** Intento que ganó el artículo (claim al precio u oferta aceptada), si ya se vendió. */
  winner: QueueRow | null;
};

/** Resumen al terminar el evento. */
export type ConsoleSummary = {
  soldCount: number;
  unsoldCount: number;
  withdrawnCount: number;
  revenueCents: number;
  buyers: { buyerId: string; name: string; winsCount: number; totalCents: number }[];
};
