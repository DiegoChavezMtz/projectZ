import { beforeAll, describe, expect, it } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { adminClient, anonClient } from '../helpers/supabase';
import {
  auditSession,
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';

// S7 contra la BD en línea (migración 16 aplicada para el caso de Realtime): visibilidad de intentos
// para la consola, resumen contra claim_wins y extensión del cierre. Solo cuentas is_test.

let seller: TestSeller;
let stranger: TestSeller;
let buyers: TestBuyer[];

beforeAll(async () => {
  seller = await createTestSeller();
  stranger = await createTestSeller();
  buyers = await createTestBuyers(2);
}, 300_000);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('S7-01 visibilidad de intentos', () => {
  it('el dueño lee todos los intentos de su evento; el comprador solo los suyos; un anónimo ninguno', async () => {
    const live = await createLiveSession(seller, { items: 1, autoConfirm: false });
    const itemId = live.itemIds[0]!;
    for (const b of buyers)
      expect((await rpc(b.client, 'claim_item', { p_item_id: itemId })).ok).toBe(true);

    const mine = await seller.client
      .from('claim_entries')
      .select('id')
      .eq('session_id', live.sessionId);
    expect(mine.data).toHaveLength(2);

    const buyerView = await buyers[0]!.client
      .from('claim_entries')
      .select('buyer_id')
      .eq('session_id', live.sessionId);
    expect(buyerView.data?.map((r) => r.buyer_id)).toEqual([buyers[0]!.user.id]);

    const foreign = await stranger.client
      .from('claim_entries')
      .select('id')
      .eq('session_id', live.sessionId);
    expect(foreign.data ?? []).toHaveLength(0);

    const anon = await anonClient()
      .from('claim_entries')
      .select('id')
      .eq('session_id', live.sessionId);
    expect(anon.data ?? []).toHaveLength(0);
  });

  it('el vendedor ve los nombres públicos de los compradores (public_profiles)', async () => {
    const { data } = await seller.client
      .from('public_profiles')
      .select('id, display_name, created_at')
      .in(
        'id',
        buyers.map((b) => b.user.id),
      );
    expect(data).toHaveLength(2);
    expect(data?.every((row) => row.created_at)).toBe(true);
  });

  it('un anónimo no recibe cambios de claim_entries por Realtime', async () => {
    const live = await createLiveSession(seller, { items: 1, autoConfirm: false });
    const client = anonClient();
    const received: unknown[] = [];
    const channel: RealtimeChannel = client.channel(`console-anon-${live.sessionId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'claim_entries',
        filter: `session_id=eq.${live.sessionId}`,
      },
      (payload) => received.push(payload),
    );
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
      });
    });
    await rpc(buyers[0]!.client, 'claim_item', { p_item_id: live.itemIds[0] });
    await wait(2_500);
    await client.removeChannel(channel);
    expect(received).toHaveLength(0);
  });

  it('el dueño sí recibe los intentos por Realtime', async () => {
    const live = await createLiveSession(seller, { items: 1, autoConfirm: false });
    const received: { id: string }[] = [];
    const channel: RealtimeChannel = seller.client.channel(`console-owner-${live.sessionId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'claim_entries',
        filter: `session_id=eq.${live.sessionId}`,
      },
      (payload) => received.push(payload.new as { id: string }),
    );
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
      });
    });
    await rpc(buyers[1]!.client, 'claim_item', { p_item_id: live.itemIds[0] });
    await wait(2_500);
    await seller.client.removeChannel(channel);
    expect(received.length).toBeGreaterThan(0);
  });
});

describe('S7-07 resumen del cierre', () => {
  it('lo vendido y los compradores del resumen coinciden con claim_wins', async () => {
    const live = await createLiveSession(seller, { items: 3, autoConfirm: false });
    const [a, b, c] = live.itemIds as [string, string, string];
    const claimA = await rpc(buyers[0]!.client, 'claim_item', { p_item_id: a });
    const claimB = await rpc(buyers[1]!.client, 'claim_item', { p_item_id: b });
    await rpc(seller.client, 'confirm_entry', { p_entry_id: claimA.entry_id });
    await rpc(seller.client, 'confirm_entry', { p_entry_id: claimB.entry_id });
    await rpc(seller.client, 'withdraw_item', { p_item_id: c });
    expect((await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).ok).toBe(
      true,
    );

    const { buildSummary } = await import('@/features/claimEvents/utils/consoleOperations');
    const [items, wins] = await Promise.all([
      seller.client.from('claim_items').select('*').eq('session_id', live.sessionId),
      seller.client
        .from('claim_wins')
        .select('id, item_id, buyer_id, price_cents, won_via')
        .eq('session_id', live.sessionId),
    ]);
    const summary = buildSummary(items.data!, wins.data!, {});
    expect(summary).toMatchObject({
      soldCount: 2,
      unsoldCount: 0,
      withdrawnCount: 1,
      revenueCents: 30_000,
    });
    expect(summary.buyers.map((x) => x.buyerId).sort()).toEqual(
      buyers.map((x) => x.user.id).sort(),
    );
    expect(await auditSession(live.sessionId)).toEqual([]);
  });
});

describe('S7-09 extender el cierre', () => {
  it('mueve closes_at hacia adelante en un evento live y deja el aviso en el feed', async () => {
    const live = await createLiveSession(seller, { items: 1, closesAt: hoursFromNow(60) });
    // starts_at es 48 h adelante en el helper, así que closes_at debe ir después.
    const next = hoursFromNow(72);
    const result = await rpc(seller.client, 'set_session_close', {
      p_session_id: live.sessionId,
      p_closes_at: next,
    });
    expect(result.ok).toBe(true);
    const { data: feed } = await adminClient()
      .from('session_feed')
      .select('type')
      .eq('session_id', live.sessionId)
      .eq('type', 'session_extended');
    expect(feed).toHaveLength(1);
  });

  it('un vendedor ajeno no puede mover el cierre y una fecha pasada se rechaza', async () => {
    const live = await createLiveSession(seller, { items: 1, closesAt: hoursFromNow(60) });
    const foreign = await rpc(stranger.client, 'set_session_close', {
      p_session_id: live.sessionId,
      p_closes_at: hoursFromNow(80),
    });
    expect(foreign).toMatchObject({ ok: false, code: 'forbidden' });
    const past = await rpc(seller.client, 'set_session_close', {
      p_session_id: live.sessionId,
      p_closes_at: hoursFromNow(-1),
    });
    expect(past).toMatchObject({ ok: false, code: 'validation_failed' });
  });
});
