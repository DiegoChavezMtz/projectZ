import type { AnyClient } from './supabase';

/**
 * Borra los datos del motor ligados a usuarios de prueba, en orden de dependencias:
 * claim_wins -> eventos (artículos, intentos, participantes y feed en cascada) -> intentos y
 * participaciones sueltas del comprador. Solo recibe ids de cuentas is_test.
 */
export async function deleteEngineData(admin: AnyClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const list = userIds.join(',');
  await admin.from('claim_wins').delete().or(`buyer_id.in.(${list}),seller_id.in.(${list})`);
  await admin.from('claim_sessions').delete().in('seller_id', userIds).eq('is_test', true);
  await admin.from('claim_entries').delete().in('buyer_id', userIds);
  await admin.from('session_participants').delete().in('user_id', userIds);
}
