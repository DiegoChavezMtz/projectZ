// Tipos compartidos de reputación (los usan la molecule ReputationBadge, servicios transversales y la feature).
export type RepRole = 'buyer' | 'seller';

/** Contadores de `public_user_stats` (camelCase). */
export type ReputationStats = {
  winsCount: number;
  sessionsParticipated: number;
  ordersPaidOnTime: number;
  ordersPaidLate: number;
  ordersUnpaid: number;
  ordersReleased: number;
  deliveriesReceived: number;
  sessionsHosted: number;
  winsSold: number;
  ordersClosedOnTime: number;
  ordersClosedLate: number;
  deliveriesOnTime: number;
  deliveriesLate: number;
  ratingAsBuyerSum: number;
  ratingAsBuyerCount: number;
  ratingAsSellerSum: number;
  ratingAsSellerCount: number;
};

/** Datos mínimos para pintar una `ReputationBadge`, listos desde una sola consulta por pantalla. */
export type BadgeData = {
  userId: string;
  handle: string;
  winsCount: number;
  memberSince: string;
  isSeller: boolean;
  rating: { average: number; count: number } | null;
  paidOnTimeRate: number | null;
  isNew: boolean;
};
