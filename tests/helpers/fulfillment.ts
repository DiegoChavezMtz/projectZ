import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase';
import { createLiveSession, rpc, type TestBuyer, type TestSeller } from './claims';

export const ADDRESS = {
  recipient: 'Luis Prueba',
  phone: '5512345678',
  street: 'Calle Falsa',
  exterior: '123',
  neighborhood: 'Centro',
  city: 'Ciudad de México',
  state: 'CDMX',
  postal_code: '06000',
};

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export type OrderRow = {
  id: string;
  session_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  items_total_cents: number;
  shipping_cents: number;
  total_cents: number;
  accumulate: boolean;
  delivery_id: string | null;
  pay_due_at: string | null;
  closed_at: string | null;
  accumulate_until: string | null;
  completed_at: string | null;
};

/** Evento terminado donde cada comprador gana `wins[i]` artículos. Devuelve las cuentas por comprador. */
export async function endedSession(
  seller: TestSeller,
  buyers: TestBuyer[],
  wins: number[],
  options: { patch?: Record<string, unknown>; priceCents?: number } = {},
) {
  const total = wins.reduce((a, b) => a + b, 0);
  const live = await createLiveSession(seller, {
    items: total,
    priceCents: options.priceCents ?? 10_000,
    patch: options.patch,
  });
  let cursor = 0;
  for (const [i, count] of wins.entries()) {
    for (let k = 0; k < count; k++) {
      const claimed = await rpc(buyers[i]!.client, 'claim_item', {
        p_item_id: live.itemIds[cursor++]!,
      });
      if (!claimed.ok) throw new Error(`claim_item: ${claimed.code}`);
    }
  }
  const ended = await rpc(seller.client, 'end_session', { p_session_id: live.sessionId });
  if (!ended.ok) throw new Error(`end_session: ${ended.code}`);
  const orders = await ordersOf(live.sessionId);
  return { live, orders: buyers.map((b) => orders.find((o) => o.buyer_id === b.user.id)!) };
}

export async function ordersOf(sessionId: string): Promise<OrderRow[]> {
  const { data, error } = await adminClient()
    .from('orders')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
  return data as OrderRow[];
}

export async function orderById(id: string): Promise<OrderRow> {
  const { data, error } = await adminClient().from('orders').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as OrderRow;
}

export async function proofsOf(targetColumn: 'order_id' | 'delivery_id', id: string) {
  const { data } = await adminClient()
    .from('payment_proofs')
    .select('id, status, reject_reason')
    .eq(targetColumn, id)
    .order('created_at');
  return data ?? [];
}

/** Cierra la cuenta, sube un comprobante y lo acepta. Devuelve la cuenta ya pagada. */
export async function closeAndPay(
  seller: TestSeller,
  buyer: TestBuyer,
  order: OrderRow,
  options: { method?: 'shipping' | 'pickup'; shippingCents?: number; accumulate?: boolean } = {},
) {
  const closed = await rpc(seller.client, 'close_order', {
    p_order_id: order.id,
    p_delivery_method: options.method ?? 'shipping',
    p_shipping_cents: options.shippingCents ?? 8_000,
  });
  if (!closed.ok) throw new Error(`close_order: ${closed.code}`);
  if (options.accumulate) {
    const set = await rpc(buyer.client, 'set_order_accumulate', {
      p_order_id: order.id,
      p_value: true,
    });
    if (!set.ok) throw new Error(`set_order_accumulate: ${set.code}`);
  }
  const needsAddress = !options.accumulate && (options.method ?? 'shipping') === 'shipping';
  const submitted = await rpc(buyer.client, 'submit_payment_proof', {
    p_target: 'order',
    p_target_id: order.id,
    p_file_path: `${order.id}/${randomUUID()}.png`,
    ...(needsAddress ? { p_address: ADDRESS } : {}),
  });
  if (!submitted.ok) throw new Error(`submit_payment_proof: ${submitted.code}`);
  const reviewed = await rpc(seller.client, 'review_payment_proof', {
    p_proof_id: submitted.proof_id,
    p_accept: true,
  });
  if (!reviewed.ok) throw new Error(`review_payment_proof: ${reviewed.code}`);
  return orderById(order.id);
}

/** Corre process_deadlines con reloj simulado (solo service role; solo procesa compradores is_test). */
export async function processDeadlines(now: Date) {
  const { data, error } = await adminClient().rpc('process_deadlines', {
    p_now: now.toISOString(),
  });
  if (error) throw new Error(`process_deadlines: ${error.message}`);
  return data as Record<string, number>;
}

export async function queuedCount(template: string, userIds: string[]) {
  const { count } = await adminClient()
    .from('notification_queue')
    .select('id', { count: 'exact', head: true })
    .eq('template', template)
    .in('user_id', userIds);
  return count ?? 0;
}

export const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

/** Lleva una cuenta hasta `completed_at`: cierre, pago aceptado, envío y recepción confirmada. */
export async function completeOrder(seller: TestSeller, buyer: TestBuyer, order: OrderRow) {
  const paid = await closeAndPay(seller, buyer, order);
  const shipped = await rpc(seller.client, 'mark_shipped', { p_delivery_id: paid.delivery_id });
  if (!shipped.ok) throw new Error(`mark_shipped: ${shipped.code}`);
  const received = await rpc(buyer.client, 'confirm_delivery', { p_delivery_id: paid.delivery_id });
  if (!received.ok) throw new Error(`confirm_delivery: ${received.code}`);
  return orderById(order.id);
}
