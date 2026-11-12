// Entidades y DTOs de la feature 'reputation' (docs/spec/reputation.md).
import type { BadgeData, RepRole, ReputationStats } from '@/types/reputation';

export type { BadgeData, RepRole, ReputationStats };

export type RepKind =
  | 'paid_on_time'
  | 'paid_late'
  | 'unpaid'
  | 'order_closed_on_time'
  | 'order_closed_late'
  | 'delivered_on_time'
  | 'delivered_late'
  | 'received'
  | 'rated'
  | 'accumulate_released';

/** Las entradas `revoked` nunca llegan a la UI. */
export type RepStatus = 'active' | 'disputed';

export type BuyerRatingTag = 'pago_rapido' | 'buena_comunicacion' | 'amable';
export type SellerRatingTag =
  'empaque_cuidadoso' | 'envio_rapido' | 'buena_comunicacion' | 'descripcion_fiel';
export type RatingTag = BuyerRatingTag | SellerRatingTag;

export type PublicProfileHeader = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  memberSince: string;
  isDeleted: boolean;
  isSeller: boolean;
  sellerSlug: string | null;
  shopName: string | null;
  sellerSince: string | null;
};

export type HistoryEntry = {
  id: string;
  role: RepRole;
  kind: RepKind;
  status: RepStatus;
  sessionCode: string | null;
  sessionTitle: string | null;
  counterpartyHandle: string | null;
  counterpartyName: string | null;
  hours: number | null;
  method: 'shipping' | 'pickup' | null;
  stars: number | null;
  tags: RatingTag[];
  comment: string | null;
  releaseReason: string | null;
  disputeNote: string | null;
  disputeResolutionNote: string | null;
  occurredAt: string;
};

export type HistoryPage = { entries: HistoryEntry[]; page: number; hasMore: boolean };

export type RatingSummary = {
  role: RepRole;
  average: number | null;
  count: number;
  distribution: { stars: number; total: number }[];
  topTags: { tag: RatingTag; total: number }[];
};

export type PublicProfile = {
  header: PublicProfileHeader;
  stats: ReputationStats;
};

export type PendingRating = {
  orderId: string;
  sessionId: string;
  sessionCode: string;
  sessionTitle: string;
  myRole: RepRole;
  counterpartyId: string;
  counterpartyHandle: string;
  counterpartyName: string;
  completedAt: string;
  rateUntil: string;
};

export type SubmitRatingInput = {
  orderId: string;
  stars: number;
  tags: RatingTag[];
  comment?: string;
};

/** Resultado uniforme de la Server Action de calificar. */
export type RatingResult = { ok: true } | { ok: false; code: string; message: string };
