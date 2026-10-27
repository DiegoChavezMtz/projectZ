import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { adminClient, anonClient } from '../helpers/supabase';
import { createLiveSession, createTestSeller, rpc, type TestSeller } from '../helpers/claims';

// S5-08 contra la BD en línea (migración 12): un anónimo recibe cambios de claim_items de un evento
// público y no de uno en borrador (Realtime respeta RLS).

let seller: TestSeller;
const channels: { client: ReturnType<typeof anonClient>; channel: RealtimeChannel }[] = [];

beforeAll(async () => {
  seller = await createTestSeller();
});

afterAll(async () => {
  for (const { client, channel } of channels) await client.removeChannel(channel);
});

function listen(sessionId: string) {
  const client = anonClient();
  const received: { id: string; status: string }[] = [];
  const channel = client.channel(`rt-${sessionId}`).on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'claim_items',
      filter: `session_id=eq.${sessionId}`,
    },
    (payload) => received.push(payload.new as { id: string; status: string }),
  );
  channels.push({ client, channel });
  const subscribed = new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        reject(new Error(`realtime: ${status}`));
    });
  });
  return { received, subscribed };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('realtime con RLS', () => {
  it('un anónimo recibe cambios de claim_items de un evento público', async () => {
    const live = await createLiveSession(seller, { live: false });
    const { received, subscribed } = listen(live.sessionId);
    await subscribed;
    await wait(1_500); // Realtime tarda un instante en enlazar el filtro tras SUBSCRIBED
    expect((await rpc(seller.client, 'start_session', { p_session_id: live.sessionId })).ok).toBe(
      true,
    );
    for (let i = 0; i < 30 && received.length === 0; i++) await wait(500);
    expect(received.map((r) => r.id)).toContain(live.itemIds[0]);
    expect(received[0]?.status).toBe('available');
  }, 45_000);

  it('un anónimo no recibe cambios de un evento en borrador', async () => {
    const { data: session } = await seller.client
      .from('claim_sessions')
      .insert({
        seller_id: seller.user.id,
        title: 'Borrador RT',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single();
    const { data: item } = await seller.client
      .from('claim_items')
      .insert({
        session_id: session!.id,
        position: 1,
        title: 'Carta',
        attributes: {},
        price_cents: 1_000,
        image_path: 'x/y/z.webp',
      })
      .select('id')
      .single();
    const { received, subscribed } = listen(session!.id);
    await subscribed;
    await wait(1_500);
    await adminClient().from('claim_items').update({ is_preview: true }).eq('id', item!.id);
    await adminClient().from('claim_items').update({ title: 'Cambio' }).eq('id', item!.id);
    await wait(4_000);
    expect(received).toEqual([]);
  }, 45_000);
});
