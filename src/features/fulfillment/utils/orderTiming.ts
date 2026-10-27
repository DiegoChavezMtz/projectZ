import type { OrderRow, OrderTiming } from '../types';

/** Campos de tiempo de una fila de `orders` para los utils puros. */
export const toOrderTiming = (order: OrderRow): OrderTiming => ({
  status: order.status,
  accumulate: order.accumulate,
  deliveryId: order.delivery_id,
  sellerId: order.seller_id,
  payDueAt: order.pay_due_at,
  paidAt: order.paid_at,
  accumulateUntil: order.accumulate_until,
  accumulateGraceUntil: order.accumulate_grace_until,
  releasedAt: order.released_at,
});

export type BuyerSection = 'toPay' | 'accumulate' | 'delivery' | 'history';

/** Dónde se muestra una cuenta en `/orders`. Las pagadas con entrega viven en la tarjeta de su entrega. */
export function buyerSection(order: OrderRow): BuyerSection {
  switch (order.status) {
    case 'pending_close':
    case 'awaiting_payment':
    case 'payment_review':
      return 'toPay';
    case 'paid':
      if (order.accumulate && !order.delivery_id) return 'accumulate';
      return order.delivery_id ? 'delivery' : 'history';
    default:
      return 'history';
  }
}

/** Días que quedan para objetar una marca de "no pagó" (0 si ya pasó el plazo de 7 días). */
export function objectionWindowOpen(unpaidAt: string | null, now: number = Date.now()): boolean {
  if (!unpaidAt) return false;
  return now <= new Date(unpaidAt).getTime() + 7 * 86_400_000;
}
