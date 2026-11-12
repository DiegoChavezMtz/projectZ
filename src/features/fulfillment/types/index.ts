import type { BadgeData } from '@/types/reputation';
import type { Database } from '@/types/database.types';

// Entidades de la feature 'fulfillment' (cuentas, pagos, entregas, guardadito).
type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type OrderStatus = Enums['order_status'];
export type DeliveryMethod = Enums['delivery_method'];
export type DeliveryStatus = Enums['delivery_status'];
export type ProofTarget = Enums['proof_target'];
export type ProofStatus = Enums['proof_status'];
export type DisputeStatus = Enums['dispute_status'];

export type OrderRow = Tables['orders']['Row'];
export type DeliveryRow = Tables['deliveries']['Row'];

/** Dirección de envío (copia en la entrega; no hay libreta de direcciones en el MVP). */
export type AddressSnapshot = {
  recipient: string;
  phone: string;
  street: string;
  exterior: string;
  interior?: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  references?: string;
};

/** Campos de una cuenta que usan los utils puros (ISO UTC en transporte). */
export type OrderTiming = {
  status: OrderStatus;
  accumulate: boolean;
  deliveryId: string | null;
  sellerId: string;
  payDueAt: string | null;
  paidAt: string | null;
  accumulateUntil: string | null;
  accumulateGraceUntil: string | null;
  releasedAt: string | null;
};

/** Razón por la que el guardadito vuelve al vendedor (`reputation_events.payload.reason`). */
export type ReleaseReason = 'grace_expired' | 'fee_unpaid' | 'buyer_request';

/** Resultado uniforme de las Server Actions de cumplimiento. */
export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

export type ProofView = {
  id: string;
  status: ProofStatus;
  rejectReason: string | null;
  createdAt: string;
  /** URL firmada de corta duración (solo se firma para comprobantes por revisar). */
  url: string | null;
  isPdf: boolean;
};

export type OrderItemLine = {
  id: string;
  title: string;
  priceCents: number;
  imagePath: string | null;
};

export type DisputeView = {
  note: string;
  status: DisputeStatus;
  resolutionNote: string | null;
};

/** Cuenta con lo necesario para mostrarla: evento, contraparte, artículos, entrega, comprobantes y objeción. */
export type OrderView = {
  order: OrderRow;
  sessionTitle: string;
  sessionCode: string;
  allowAccumulate: boolean;
  accumulateDays: number;
  /** Vendedor (vista del comprador) o comprador (vista del vendedor). */
  counterpart: string;
  /** Reputación de la contraparte (una consulta por pantalla). */
  counterpartBadge: BadgeData | null;
  items: OrderItemLine[];
  proofs: ProofView[];
  dispute: DisputeView | null;
};

export type DeliveryView = {
  delivery: DeliveryRow;
  counterpart: string;
  counterpartBadge: BadgeData | null;
  orders: OrderView[];
  proofs: ProofView[];
};

export type BuyerOrders = { orders: OrderView[]; deliveries: DeliveryView[] };
export type SellerInbox = { orders: OrderView[]; deliveries: DeliveryView[] };

/** Bandejas del vendedor en `/dashboard/orders`. */
export type SellerTab =
  | 'toClose'
  | 'awaitingPayment'
  | 'toReview'
  | 'toQuote'
  | 'toShip'
  | 'shipped'
  | 'unpaid'
  | 'released';
