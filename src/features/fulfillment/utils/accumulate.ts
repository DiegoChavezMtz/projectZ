import type { OrderTiming } from '../types';

const toTime = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/**
 * ¿Puede el comprador incluir esta cuenta en una solicitud de entrega? Réplica en cliente de
 * `request_delivery`: pagada, acumulada, sin entrega, no liberada y, si ya venció el guardadito, dentro del
 * plazo de gracia. La base de datos es la autoridad.
 */
export function canRequestDelivery(order: OrderTiming, now: Date | number = Date.now()): boolean {
  if (order.status !== 'paid' || !order.accumulate) return false;
  if (order.deliveryId !== null || order.releasedAt !== null) return false;
  const grace = toTime(order.accumulateGraceUntil);
  const current = typeof now === 'number' ? now : now.getTime();
  return grace === null || current < grace;
}

/** ¿El guardadito ya venció (hay que confirmar el envío o se liberará)? */
export function isAccumulateExpired(order: OrderTiming, now: Date | number = Date.now()): boolean {
  const until = toTime(order.accumulateUntil);
  if (order.status !== 'paid' || !order.accumulate || until === null) return false;
  return (typeof now === 'number' ? now : now.getTime()) >= until;
}

export type AccumulableGroup<T extends OrderTiming> = { sellerId: string; orders: T[] };

/**
 * Agrupa por vendedor las cuentas que pueden juntarse en una entrega (no se mezclan vendedores).
 * Orden estable: vendedor por primera aparición y cuentas por vencimiento del guardadito más cercano.
 */
export function groupAccumulableOrders<T extends OrderTiming>(
  orders: T[],
  now: Date | number = Date.now(),
): AccumulableGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const order of orders) {
    if (!canRequestDelivery(order, now)) continue;
    const list = groups.get(order.sellerId) ?? [];
    list.push(order);
    groups.set(order.sellerId, list);
  }
  return [...groups.entries()].map(([sellerId, list]) => ({
    sellerId,
    orders: [...list].sort(
      (a, b) =>
        (toTime(a.accumulateUntil) ?? Number.POSITIVE_INFINITY) -
        (toTime(b.accumulateUntil) ?? Number.POSITIVE_INFINITY),
    ),
  }));
}
