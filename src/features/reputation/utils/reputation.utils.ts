// Cálculo puro de reputación (docs/spec/reputation.md). Sin React ni red.
import { formatMonthYear } from '@/utils/dates';
import { ratingTagLabels, reputationContent } from '../content/es-MX';
import type {
  BuyerRatingTag,
  HistoryEntry,
  RatingTag,
  RepRole,
  ReputationStats,
  SellerRatingTag,
} from '../types';

export const BUYER_TO_SELLER_TAGS: readonly SellerRatingTag[] = [
  'empaque_cuidadoso',
  'envio_rapido',
  'buena_comunicacion',
  'descripcion_fiel',
];
export const SELLER_TO_BUYER_TAGS: readonly BuyerRatingTag[] = [
  'pago_rapido',
  'buena_comunicacion',
  'amable',
];

export const RATING_TAGS: readonly RatingTag[] = [
  'empaque_cuidadoso',
  'envio_rapido',
  'buena_comunicacion',
  'descripcion_fiel',
  'pago_rapido',
  'amable',
];

/** Etiquetas que puede elegir quien califica según su rol. */
export const tagsForRater = (raterRole: RepRole): readonly RatingTag[] =>
  raterRole === 'buyer' ? BUYER_TO_SELLER_TAGS : SELLER_TO_BUYER_TAGS;

export const formatPercent = (rate: number) => Math.round(rate * 100);

/** 4.666 → "4.7" */
export const formatRating = (average: number) => average.toFixed(1);

/** "Miembro desde octubre de 2026" */
export const formatMemberSince = (iso: string) =>
  reputationContent.memberSince(formatMonthYear(iso));

export const formatSellerSince = (iso: string) =>
  reputationContent.sellerSince(formatMonthYear(iso));

/** Bloques del perfil: solo se muestran los que tienen datos. */
export const hasBuyerData = (stats: ReputationStats) =>
  stats.winsCount +
    stats.sessionsParticipated +
    stats.ordersPaidOnTime +
    stats.ordersPaidLate +
    stats.ordersUnpaid +
    stats.ordersReleased +
    stats.deliveriesReceived +
    stats.ratingAsBuyerCount >
  0;

export const hasSellerData = (stats: ReputationStats) =>
  stats.sessionsHosted +
    stats.winsSold +
    stats.ordersClosedOnTime +
    stats.ordersClosedLate +
    stats.deliveriesOnTime +
    stats.deliveriesLate +
    stats.ratingAsSellerCount >
  0;

/** 0.4 → "menos de 1 h"; 3.5 → "3.5 h"; 30 → "30 h"; 49 → "2 días". */
export function formatDuration(hours: number): string {
  const d = reputationContent.durations;
  if (hours < 1) return d.lessThanHour;
  if (hours < 48) return d.hours(Math.round(hours * 10) / 10);
  const days = Math.floor(hours / 24);
  return days === 1 ? d.day : d.days(days);
}

export type HistoryTone = 'positive' | 'negative' | 'neutral';
export type HistoryLine = {
  title: string;
  tone: HistoryTone;
  disputed: boolean;
  /** Etiquetas de una calificación, ya con su texto. */
  tagLabels: string[];
};

/** Texto y tono de una entrada del historial. */
export function formatHistoryEntry(entry: HistoryEntry): HistoryLine {
  const h = reputationContent.history;
  const duration = entry.hours === null ? null : formatDuration(entry.hours);
  const pickup = entry.method === 'pickup';
  const withDuration = (build: (d: string) => string, fallback: string) =>
    duration === null ? fallback : build(duration);

  let title: string;
  let tone: HistoryTone;
  switch (entry.kind) {
    case 'paid_on_time':
      title = withDuration(h.paidOnTime, 'Pagó a tiempo');
      tone = 'positive';
      break;
    case 'paid_late':
      title = withDuration(h.paidLate, 'Pagó tarde');
      tone = 'negative';
      break;
    case 'unpaid':
      title = h.unpaid;
      tone = 'negative';
      break;
    case 'order_closed_on_time':
      title = withDuration(h.closedOnTime, 'Cerró la cuenta a tiempo');
      tone = 'positive';
      break;
    case 'order_closed_late':
      title = withDuration(h.closedLate, 'Cerró la cuenta tarde');
      tone = 'negative';
      break;
    case 'delivered_on_time':
      title = withDuration(pickup ? h.pickupOnTime : h.shippedOnTime, 'Envió a tiempo');
      tone = 'positive';
      break;
    case 'delivered_late':
      title = withDuration(pickup ? h.pickupLate : h.shippedLate, 'Envío tardío');
      tone = 'negative';
      break;
    case 'received':
      title = h.received;
      tone = 'positive';
      break;
    case 'rated':
      title = entry.stars === null ? 'Recibió una calificación' : h.rated(entry.stars);
      tone = entry.stars !== null && entry.stars <= 2 ? 'negative' : 'positive';
      break;
    case 'accumulate_released': {
      const reason = entry.releaseReason
        ? reputationContent.releasedReasons[entry.releaseReason]
        : undefined;
      title = reason ? h.releasedWithReason(reason) : h.released;
      tone = 'neutral'; // no es un impago: sin estilo de advertencia
      break;
    }
  }

  return {
    title,
    tone,
    disputed: entry.status === 'disputed',
    tagLabels: groupTagLabels(entry.tags),
  };
}

const groupTagLabels = (tags: RatingTag[]) => tags.map((tag) => ratingTagLabels[tag]);

/** Etiquetas más frecuentes primero (empate: orden alfabético del texto), con tope opcional. */
export function groupTags(
  rows: { tag: RatingTag; total: number }[],
  limit = 4,
): { tag: RatingTag; label: string; total: number }[] {
  const merged = new Map<RatingTag, number>();
  for (const row of rows) merged.set(row.tag, (merged.get(row.tag) ?? 0) + row.total);
  return [...merged.entries()]
    .map(([tag, total]) => ({ tag, label: ratingTagLabels[tag], total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es-MX'))
    .slice(0, limit);
}

/** Distribución 5 → 1 completa (con ceros) y su porcentaje sobre el total. */
export function ratingDistribution(rows: { stars: number; total: number }[]) {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.stars, (counts.get(row.stars) ?? 0) + row.total);
  const all = [5, 4, 3, 2, 1].map((stars) => ({ stars, total: counts.get(stars) ?? 0 }));
  const sum = all.reduce((acc, row) => acc + row.total, 0);
  return all.map((row) => ({ ...row, share: sum === 0 ? 0 : row.total / sum }));
}

export {
  MIN_CASES,
  averageRating,
  closedOnTimeRate,
  deliveryOnTimeRate,
  isNewUser,
  paidOnTimeRate,
  ratingAsRole,
  toBadgeData,
} from '@/utils/reputationStats';
