import type { RealtimeChannel } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';
import { adminClient, anonClient, type AnyClient } from '../helpers/supabase';
import type { ClaimItem, ClaimSession, SessionFeedEvent } from '@/types/claims';

// S6: visor en vivo contra la BD en línea (cuentas is_test, limpieza en setup). El cliente de servidor
// se sustituye por uno intercambiable para ver el evento como anónimo o como el dueño.
let serverClient: AnyClient = anonClient();
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => serverClient }));

const { snapshotService } = await import('@/features/liveClaim/services/snapshot.service');
const { queryLiveList } = await import('@/features/liveClaim/services/liveQueries');
const { calendarService } = await import('@/features/liveClaim/services/calendar.service');
const { liveReducer, createInitialState } = await import('@/features/liveClaim/utils/liveReducer');
const { publicItemState } = await import('@/features/liveClaim/utils/itemState');

let seller: TestSeller;
let buyers: TestBuyer[];
const channels: { client: AnyClient; channel: RealtimeChannel }[] = [];

beforeAll(async () => {
  seller = await createTestSeller();
  buyers = await createTestBuyers(4);
});

afterAll(async () => {
  for (const { client, channel } of channels) await client.removeChannel(channel);
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function codeOf(sessionId: string) {
  const { data } = await seller.client.from('claim_sessions').select('code').eq('id', sessionId).single();
  return data!.code;
}

/** Cliente anónimo que aplica los tres `postgres_changes` con el mismo reducer que usa el visor. */
async function watch(initial: { session: ClaimSession; items: ClaimItem[]; feed: SessionFeedEvent[] }) {
  let state = createInitialState(initial);
  const client = anonClient();
  const id = initial.session.id;
  const channel = client
    .channel(`viewer-${id}-${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_items', filter: `session_id=eq.${id}` }, (p) => {
      if (p.eventType !== 'DELETE') state = liveReducer(state, { type: 'item', item: p.new as ClaimItem });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_feed', filter: `session_id=eq.${id}` }, (p) => {
      state = liveReducer(state, { type: 'feed', event: p.new as SessionFeedEvent });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'claim_sessions', filter: `id=eq.${id}` }, (p) => {
      state = liveReducer(state, { type: 'session', session: p.new as ClaimSession });
    });
  channels.push({ client, channel });
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`realtime: ${status}`));
    });
  });
  await wait(1_500);
  return { get state() { return state; } };
}

describe('visor: realtime', () => {
  it('dos clientes convergen al mismo estado final tras una ráfaga de acciones', async () => {
    const live = await createLiveSession(seller, { items: 4, autoConfirm: false, priceCents: 20_000 });
    const snapshot = await snapshotService.getSnapshot(await codeOf(live.sessionId));
    expect(snapshot).not.toBeNull();
    const base = { session: snapshot!.session, items: snapshot!.items, feed: snapshot!.feed };
    const [a, b] = [await watch(base), await watch(base)];

    // Ráfaga: todos reclaman todo a la vez, más ofertas y retiros.
    await Promise.all([
      ...buyers.flatMap((buyer) => live.itemIds.map((id) => rpc(buyer.client, 'claim_item', { p_item_id: id }))),
      rpc(buyers[0]!.client, 'make_offer', { p_item_id: live.itemIds[1], p_amount_cents: 10_000 }),
      rpc(buyers[1]!.client, 'make_offer', { p_item_id: live.itemIds[2], p_amount_cents: 12_000 }),
    ]);
    await rpc(seller.client, 'post_announcement', { p_session_id: live.sessionId, p_text: 'Ráfaga lista' });

    const admin = adminClient();
    const truth = async () => {
      const [items, feed] = await Promise.all([
        admin.from('claim_items').select('*').eq('session_id', live.sessionId).order('position'),
        admin.from('session_feed').select('id').eq('session_id', live.sessionId).order('id'),
      ]);
      return { items: items.data as ClaimItem[], feedIds: (feed.data ?? []).map((e) => e.id as number) };
    };
    const summarize = (items: ClaimItem[]) =>
      items.map((i) => ({ id: i.id, state: publicItemState(i), leader: i.leader_user_id, offers: i.offer_count }));

    let expected = await truth();
    for (let i = 0; i < 40; i++) {
      const doneA = a.state.feed.at(-1)?.id === expected.feedIds.at(-1);
      const doneB = b.state.feed.at(-1)?.id === expected.feedIds.at(-1);
      if (doneA && doneB) break;
      await wait(500);
      expected = await truth();
    }
    await wait(1_000);
    expected = await truth();

    expect(summarize(a.state.items)).toEqual(summarize(expected.items));
    expect(summarize(b.state.items)).toEqual(summarize(a.state.items));
    expect(b.state.feed.map((e) => e.id)).toEqual(a.state.feed.map((e) => e.id));
    expect(a.state.feed.map((e) => e.id)).toEqual(expected.feedIds.slice(-a.state.feed.length));
    // Cada artículo tiene un líder y el estado público es "reclamada" o "con oferta" según corresponda.
    expect(a.state.items.every((i) => i.leader_user_id !== null)).toBe(true);
  }, 120_000);
});

describe('visor: snapshot, vendedor y calendario', () => {
  it('el snapshot trae al vendedor (tienda) sin datos de pago', async () => {
    serverClient = anonClient();
    const live = await createLiveSession(seller, { items: 1 });
    const snapshot = await snapshotService.getSnapshot(await codeOf(live.sessionId));
    expect(snapshot!.seller).toMatchObject({ id: seller.user.id, shopName: 'Tienda de prueba' });
    expect(JSON.stringify(snapshot)).not.toContain('payment_instructions');
  });

  it('el borrador solo lo ve su dueño; el cancelado nadie', async () => {
    const { data: draft } = await seller.client
      .from('claim_sessions')
      .insert({ seller_id: seller.user.id, title: 'Borrador', starts_at: new Date(Date.now() + 86_400_000).toISOString() })
      .select('id, code')
      .single();

    serverClient = anonClient();
    expect(await snapshotService.getSnapshot(draft!.code)).toBeNull();
    expect(await snapshotService.getSnapshot(draft!.code, seller.user.id)).toBeNull(); // RLS: anónimo no lo lee

    serverClient = seller.client;
    const own = await snapshotService.getSnapshot(draft!.code, seller.user.id);
    expect(own?.session.status).toBe('draft');
    expect(await snapshotService.getSnapshot(draft!.code, buyers[0]!.user.id)).toBeNull(); // otro usuario con sesión

    expect((await rpc(seller.client, 'cancel_session', { p_session_id: draft!.id })).ok).toBe(true);
    expect(await snapshotService.getSnapshot(draft!.code, seller.user.id)).toBeNull();
    serverClient = anonClient();
  });

  it('el comprador solo lee sus propios intentos', async () => {
    const live = await createLiveSession(seller, { items: 1, autoConfirm: false });
    await rpc(buyers[0]!.client, 'claim_item', { p_item_id: live.itemIds[0] });
    await rpc(buyers[1]!.client, 'claim_item', { p_item_id: live.itemIds[0] });
    serverClient = buyers[0]!.client;
    const entries = await snapshotService.getViewerEntries(live.sessionId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ item_id: live.itemIds[0], kind: 'claim', status: 'queued' });
    serverClient = buyers[1]!.client;
    expect(await snapshotService.getViewerEntries(live.sessionId)).toHaveLength(1);
    serverClient = anonClient();
  });

  it('/live excluye los eventos de prueba', async () => {
    serverClient = anonClient();
    const live = await createLiveSession(seller, { items: 1 });
    const list = await queryLiveList(anonClient());
    expect(list.map((entry) => entry.session.id)).not.toContain(live.sessionId);
  });

  it('el .ics existe solo para eventos publicados', async () => {
    serverClient = anonClient();
    const scheduled = await createLiveSession(seller, { items: 1, live: false });
    const file = await calendarService.getIcs(await codeOf(scheduled.sessionId));
    expect(file?.filename).toMatch(/^claim-.+\.ics$/);
    expect(file?.body).toContain('TRIGGER:-PT10M');
    expect(file?.body).toContain('/c/');

    const { data: draft } = await seller.client
      .from('claim_sessions')
      .insert({ seller_id: seller.user.id, title: 'Borrador ics', starts_at: new Date(Date.now() + 86_400_000).toISOString() })
      .select('code')
      .single();
    expect(await calendarService.getIcs(draft!.code)).toBeNull();
    expect(await calendarService.getIcs('NOEXISTE')).toBeNull();
  });
});
