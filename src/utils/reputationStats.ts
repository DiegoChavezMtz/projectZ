// Cálculo puro de reputación compartido (lo usan la feature `reputation` y los servicios de insignias).
import type { BadgeData, RepRole, ReputationStats } from '@/types/reputation';

/** Mínimo de casos para mostrar un porcentaje; con menos, "Aún sin suficiente historial". */
export const MIN_CASES = 3;

/** paid_on_time / (paid_on_time + paid_late + unpaid). Null con menos de 3 casos. */
export function paidOnTimeRate(
  stats: Pick<ReputationStats, 'ordersPaidOnTime' | 'ordersPaidLate' | 'ordersUnpaid'>,
): number | null {
  const total = stats.ordersPaidOnTime + stats.ordersPaidLate + stats.ordersUnpaid;
  return total < MIN_CASES ? null : stats.ordersPaidOnTime / total;
}

/** on_time / (on_time + late). Null con menos de 3 casos. */
export function deliveryOnTimeRate(
  stats: Pick<ReputationStats, 'deliveriesOnTime' | 'deliveriesLate'>,
): number | null {
  const total = stats.deliveriesOnTime + stats.deliveriesLate;
  return total < MIN_CASES ? null : stats.deliveriesOnTime / total;
}

/** Cuentas cerradas a tiempo entre todas las cerradas. Null con menos de 3 casos. */
export function closedOnTimeRate(
  stats: Pick<ReputationStats, 'ordersClosedOnTime' | 'ordersClosedLate'>,
): number | null {
  const total = stats.ordersClosedOnTime + stats.ordersClosedLate;
  return total < MIN_CASES ? null : stats.ordersClosedOnTime / total;
}

/** Promedio de estrellas; null sin calificaciones. */
export const averageRating = (sum: number, count: number): number | null =>
  count > 0 ? sum / count : null;

/** Usuario sin ningún evento de reputación. */
export function isNewUser(stats: ReputationStats): boolean {
  return Object.values(stats).every((value) => value === 0);
}

export function ratingAsRole(stats: ReputationStats, role: RepRole) {
  return role === 'buyer'
    ? { sum: stats.ratingAsBuyerSum, count: stats.ratingAsBuyerCount }
    : { sum: stats.ratingAsSellerSum, count: stats.ratingAsSellerCount };
}

export function toBadgeData(
  header: { userId: string; handle: string; memberSince: string; isSeller: boolean },
  stats: ReputationStats,
): BadgeData {
  const rating = ratingAsRole(stats, header.isSeller ? 'seller' : 'buyer');
  const average = averageRating(rating.sum, rating.count);
  return {
    userId: header.userId,
    handle: header.handle,
    winsCount: header.isSeller ? stats.winsSold : stats.winsCount,
    memberSince: header.memberSince,
    isSeller: header.isSeller,
    rating: average === null ? null : { average, count: rating.count },
    paidOnTimeRate: header.isSeller ? null : paidOnTimeRate(stats),
    isNew: isNewUser(stats),
  };
}
