import type {
  ClaimItem,
  ClaimSession,
  ItemStatus,
  SessionFeedEvent,
  SessionStatus,
} from '@/types/claims';
import type { CategoryDefinition } from '@/types/categories';
import type { Database } from '@/types/database.types';

/** Resultado de `claim_item`. */
export type ClaimItemResult = {
  entryId: string;
  /** Posición en la cola del artículo (1 = líder). */
  position: number;
  itemStatus: ItemStatus;
  /** true si `auto_confirm` adjudicó el artículo en la misma llamada. */
  won: boolean;
};

export type MakeOfferResult = { entryId: string };

/**
 * Lo que el visor necesita de una categoría para pintar (textos, proporción de imagen y campos).
 * Se arma en el servidor: así el esquema Zod de la categoría no viaja al navegador.
 */
export type CategoryView = Pick<CategoryDefinition, 'id' | 'itemLabels' | 'imageAspect' | 'fields'>;

/** Vendedor tal como lo ve el público (sin datos de pago). */
export type LiveSeller = {
  id: string;
  /** Nombre de la tienda. */
  shopName: string;
  handle: string | null;
  city: string | null;
};

/** Tarjeta de `/live`. */
export type LiveListEntry = {
  session: Pick<ClaimSession, 'id' | 'code' | 'title' | 'category' | 'started_at' | 'starts_at'>;
  seller: LiveSeller;
  availableCount: number;
  totalCount: number;
};

/** Estado inicial del visor: lo que el server component entrega a `useLiveClaim`. */
export type LiveSnapshot = {
  session: ClaimSession;
  /** Artículos visibles para el público, por `position`. */
  items: ClaimItem[];
  /** Últimos eventos del feed, ascendentes por `id`. */
  feed: SessionFeedEvent[];
  /** Hora del servidor (ISO UTC) al armar el snapshot. */
  serverNow: string;
  seller: LiveSeller;
};

export const FEED_LIMIT = 50;
/** Máximo de eventos del feed que el cliente conserva en memoria. */
export const FEED_MEMORY_LIMIT = 200;

type EntryRow = Database['public']['Tables']['claim_entries']['Row'];

/** Intento propio del comprador (RLS: solo ve los suyos). */
export type ViewerEntry = Pick<
  EntryRow,
  'id' | 'item_id' | 'kind' | 'amount_cents' | 'status' | 'seq'
>;

/** Comprador con sesión que mira el evento. */
export type Viewer = { id: string } | null;

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

/** Estado público de un artículo, igual para todos los espectadores. */
export type PublicItemState =
  | 'upcoming' // aún oculto (preview antes de salir)
  | 'available'
  | 'claimed'
  | 'offers'
  | 'sold'
  | 'withdrawn';

/** Relación del espectador con el artículo. */
export type ViewerRelation =
  | 'none'
  | 'sending' // acción optimista en curso
  | 'leading' // su claim va primero
  | 'queued' // su claim está en la fila
  | 'offered' // su oferta está pendiente
  | 'won' // el artículo es suyo
  | 'lost'; // el artículo se vendió a otra persona y él tenía intento

export type ItemView = {
  state: PublicItemState;
  relation: ViewerRelation;
  /** Intento propio abierto (para "Retirar"). */
  openEntry: ViewerEntry | null;
  canClaim: boolean;
  canOffer: boolean;
};

/** Acción optimista pendiente de respuesta del servidor. */
export type PendingAction = { kind: 'claim' | 'offer'; amountCents?: number };

export type LiveState = {
  session: ClaimSession;
  items: ClaimItem[];
  feed: SessionFeedEvent[];
  connection: ConnectionStatus;
  entries: ViewerEntry[];
  pending: Record<string, PendingAction>;
};

export type LiveAction =
  | { type: 'snapshot'; items: ClaimItem[]; feed: SessionFeedEvent[]; session: ClaimSession }
  | { type: 'item'; item: ClaimItem }
  | { type: 'feed'; event: SessionFeedEvent }
  | { type: 'session'; session: ClaimSession }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'entries'; entries: ViewerEntry[] }
  | { type: 'pendingStart'; itemId: string; action: PendingAction }
  | { type: 'pendingDone'; itemId: string; entry?: ViewerEntry }
  | { type: 'pendingFail'; itemId: string }
  | { type: 'entryWithdrawn'; entryId: string };

export type ItemFilter = 'all' | 'available' | 'mine' | 'sold';

export type { SessionStatus };
