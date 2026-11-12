import type { AnyClient } from './supabase';

/**
 * Borra los datos del motor y del cumplimiento ligados a usuarios de prueba, en orden de dependencias:
 * comprobantes, objeciones, reputación y cola -> claim_wins -> cuentas -> entregas -> eventos (artículos,
 * intentos, participantes y feed en cascada) -> intentos y participaciones sueltas del comprador.
 * Solo recibe ids de cuentas is_test.
 */
export async function deleteEngineData(admin: AnyClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const list = userIds.join(',');
  const party = `buyer_id.in.(${list}),seller_id.in.(${list})`;

  const { data: orders } = await admin.from('orders').select('id').or(party);
  const { data: deliveries } = await admin.from('deliveries').select('id').or(party);
  const orderIds = (orders ?? []).map((row) => row.id);
  const deliveryIds = (deliveries ?? []).map((row) => row.id);

  if (orderIds.length > 0) {
    await admin.from('ratings').delete().in('order_id', orderIds);
    await admin.from('payment_proofs').delete().in('order_id', orderIds);
    await admin.from('order_disputes').delete().in('order_id', orderIds);
  }
  if (deliveryIds.length > 0)
    await admin.from('payment_proofs').delete().in('delivery_id', deliveryIds);
  await admin.from('reputation_events').delete().in('user_id', userIds);
  await admin.from('notification_queue').delete().in('user_id', userIds);

  await admin.from('claim_wins').delete().or(party);
  if (orderIds.length > 0) await admin.from('orders').delete().in('id', orderIds);
  if (deliveryIds.length > 0) await admin.from('deliveries').delete().in('id', deliveryIds);
  await admin.from('claim_sessions').delete().in('seller_id', userIds).eq('is_test', true);
  await admin.from('claim_entries').delete().in('buyer_id', userIds);
  await admin.from('session_participants').delete().in('user_id', userIds);
}
