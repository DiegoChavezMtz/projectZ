import { randomUUID } from 'node:crypto';
import { adminClient, type AnyClient } from './supabase';
import { createTestUser, signInAs, type TestUser } from './users';

export type TestSeller = { user: TestUser; client: AnyClient };

/** Vendedor de prueba con seller_profile (alta por service role) y sesión iniciada. */
export async function createTestSeller(): Promise<TestSeller> {
  const user = await createTestUser();
  const { error } = await adminClient()
    .from('seller_profiles')
    .insert({
      user_id: user.id,
      slug: `t-${randomUUID().slice(0, 8)}`,
      shop_name: 'Tienda de prueba',
    });
  if (error) throw new Error(`No se pudo crear el vendedor de prueba: ${error.message}`);
  return { user, client: await signInAs(user) };
}

export const futureIso = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();

export function sessionRow(sellerId: string, patch: Record<string, unknown> = {}) {
  return { seller_id: sellerId, title: 'Claim de prueba', starts_at: futureIso(), ...patch };
}

export function itemRow(sessionId: string, position: number, patch: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    position,
    title: `Carta ${position}`,
    attributes: { language: 'es', condition: 'NM' },
    price_cents: 15_000,
    image_path: 'x/y/z.webp',
    ...patch,
  };
}
