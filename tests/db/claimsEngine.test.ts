import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import {
  auditSession,
  auditUserStats,
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';

// S5-01 a S5-05, S5-07 y S5-11 contra la BD en línea (migraciones 09 a 13): helpers, ciclo del evento,
// claims, cola, ofertas, permisos y auditoría. Usuarios is_test; la limpieza corre en tests/db/setup.ts.

let seller: TestSeller;
let otherSeller: TestSeller;
let buyers: TestBuyer[];
let b1: TestBuyer;
let b2: TestBuyer;
let b3: TestBuyer;
let b4: TestBuyer;

beforeAll(async () => {
  seller = await createTestSeller();
  otherSeller = await createTestSeller();
  buyers = await createTestBuyers(4);
  [b1, b2, b3, b4] = buyers as [TestBuyer, TestBuyer, TestBuyer, TestBuyer];
}, 600_000);

const admin = () => adminClient();
const claim = (buyer: TestBuyer, itemId: string) =>
  rpc(buyer.client, 'claim_item', { p_item_id: itemId });
const offer = (buyer: TestBuyer, itemId: string, amount: number) =>
  rpc(buyer.client, 'make_offer', { p_item_id: itemId, p_amount_cents: amount });

async function itemRowOf(itemId: string) {
  const { data, error } = await admin().from('claim_items').select('*').eq('id', itemId).single();
  expect(error).toBeNull();
  return data!;
}

async function statsOf(userId: string) {
  const { data, error } = await admin()
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function entriesOf(itemId: string) {
  const { data } = await admin()
    .from('claim_entries')
    .select('id, buyer_id, kind, status, seq, amount_cents')
    .eq('item_id', itemId)
    .order('seq');
  return data ?? [];
}

describe('S5-01 helpers', () => {
  it('server_now es público y devuelve la hora del servidor', async () => {
    const { data, error } = await anonClient().rpc('server_now');
    expect(error).toBeNull();
    expect(Math.abs(new Date(data as string).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('bump_stat incrementa solo columnas permitidas y no es invocable por usuarios', async () => {
    const before = (await statsOf(b1.user.id)).wins_count;
    expect(
      (
        await admin().rpc('bump_stat', {
          p_user_id: b1.user.id,
          p_column: 'wins_count',
          p_delta: 2,
        })
      ).error,
    ).toBeNull();
    expect((await statsOf(b1.user.id)).wins_count).toBe(before + 2);
    expect(
      (
        await admin().rpc('bump_stat', {
          p_user_id: b1.user.id,
          p_column: 'wins_count',
          p_delta: -2,
        })
      ).error,
    ).toBeNull();

    const bad = await admin().rpc('bump_stat', {
      p_user_id: b1.user.id,
      p_column: 'user_id',
      p_delta: 1,
    });
    expect(bad.error).not.toBeNull();
    const injected = await admin().rpc('bump_stat', {
      p_user_id: b1.user.id,
      p_column: 'wins_count = 99; --',
      p_delta: 1,
    });
    expect(injected.error).not.toBeNull();

    const asUser = await b1.client.rpc('bump_stat', {
      p_user_id: b1.user.id,
      p_column: 'wins_count',
      p_delta: 5,
    });
    expect(asUser.error).not.toBeNull();
    expect((await statsOf(b1.user.id)).wins_count).toBe(before);
  });

  it('rpc_error y is_session_owner', async () => {
    const { sessionId } = await createLiveSession(seller);
    const err = await admin().rpc('rpc_error', { p_code: 'x', p_message: 'y' });
    expect(err.data).toEqual({ ok: false, code: 'x', message: 'y' });
    const own = await admin().rpc('is_session_owner', {
      p_session_id: sessionId,
      p_uid: seller.user.id,
    });
    const foreign = await admin().rpc('is_session_owner', {
      p_session_id: sessionId,
      p_uid: b1.user.id,
    });
    expect([own.data, foreign.data]).toEqual([true, false]);
  });

  it('log_session_feed inserta con el nombre del actor; los usuarios no pueden llamarla', async () => {
    const { sessionId } = await createLiveSession(seller);
    const ok = await admin().rpc('log_session_feed', {
      p_session_id: sessionId,
      p_item_id: null,
      p_type: 'announcement',
      p_actor_id: seller.user.id,
      p_payload: { text: 'hola' },
    });
    expect(ok.error).toBeNull();
    const { data } = await admin()
      .from('session_feed')
      .select('type, actor_display_name, payload')
      .eq('session_id', sessionId)
      .eq('type', 'announcement');
    expect(data).toEqual([
      {
        type: 'announcement',
        actor_display_name: seller.user.displayName,
        payload: { text: 'hola' },
      },
    ]);
    const denied = await seller.client.rpc('log_session_feed', {
      p_session_id: sessionId,
      p_type: 'announcement',
    });
    expect(denied.error).not.toBeNull();
  });

  it('recompute_item_state fija líder (menor seq) y offer_count desde claim_entries', async () => {
    const { sessionId, itemIds } = await createLiveSession(seller, { autoConfirm: false });
    const itemId = itemIds[0]!;
    const row = (buyer: TestBuyer, patch: object) => ({
      session_id: sessionId,
      item_id: itemId,
      buyer_id: buyer.user.id,
      kind: 'claim',
      amount_cents: 15_000,
      status: 'queued',
      ...patch,
    });
    await admin().from('claim_entries').insert(row(b2, {}));
    await admin().from('claim_entries').insert(row(b1, {}));
    await admin()
      .from('claim_entries')
      .insert(row(b3, { kind: 'offer', status: 'pending', amount_cents: 100 }));
    expect((await admin().rpc('recompute_item_state', { p_item_id: itemId })).error).toBeNull();
    const item = await itemRowOf(itemId);
    expect(item.leader_user_id).toBe(b2.user.id);
    expect(item.leader_handle).toBeTruthy();
    expect(item.leader_wins_count).toBe(0);
    expect(item.offer_count).toBe(1);
  });
});

describe('S5-02 ciclo del evento', () => {
  it('start_session: pasa a live, libera todo, cuenta sessions_hosted y rechaza repetirse', async () => {
    const before = (await statsOf(seller.user.id)).sessions_hosted;
    const live = await createLiveSession(seller, { items: 3 });
    const { data: session } = await admin()
      .from('claim_sessions')
      .select('status, started_at')
      .eq('id', live.sessionId)
      .single();
    expect(session?.status).toBe('live');
    expect(session?.started_at).not.toBeNull();
    const { data: items } = await admin()
      .from('claim_items')
      .select('status, released_at')
      .eq('session_id', live.sessionId);
    expect(items?.every((i) => i.status === 'available' && i.released_at)).toBe(true);
    expect((await statsOf(seller.user.id)).sessions_hosted).toBe(before + 1);

    expect(
      await rpc(seller.client, 'start_session', { p_session_id: live.sessionId }),
    ).toMatchObject({ ok: false, code: 'invalid_state' });
    expect((await statsOf(seller.user.id)).sessions_hosted).toBe(before + 1);
  });

  it('start_session desde draft es inválido', async () => {
    const { data } = await seller.client
      .from('claim_sessions')
      .insert({
        seller_id: seller.user.id,
        title: 'Borrador',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single();
    expect(await rpc(seller.client, 'start_session', { p_session_id: data!.id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
  });

  it('las RPC del vendedor rechazan a ajenos, compradores y anónimos', async () => {
    const live = await createLiveSession(seller, { releaseMode: 'manual' });
    const itemId = live.itemIds[0]!;
    for (const who of [otherSeller, b1]) {
      expect(
        await rpc(who.client, 'start_session', { p_session_id: live.sessionId }),
      ).toMatchObject({ ok: false, code: 'forbidden' });
      expect(await rpc(who.client, 'end_session', { p_session_id: live.sessionId })).toMatchObject({
        ok: false,
        code: 'forbidden',
      });
      expect(await rpc(who.client, 'release_item', { p_item_id: itemId })).toMatchObject({
        ok: false,
        code: 'forbidden',
      });
      expect(
        await rpc(who.client, 'release_all_items', { p_session_id: live.sessionId }),
      ).toMatchObject({ ok: false, code: 'forbidden' });
      expect(await rpc(who.client, 'withdraw_item', { p_item_id: itemId })).toMatchObject({
        ok: false,
        code: 'forbidden',
      });
      expect(
        await rpc(who.client, 'post_announcement', { p_session_id: live.sessionId, p_text: 'x' }),
      ).toMatchObject({ ok: false, code: 'forbidden' });
      expect(await rpc(who.client, 'feature_item', { p_item_id: itemId })).toMatchObject({
        ok: false,
        code: 'forbidden',
      });
    }
    expect(
      (await anonClient().rpc('end_session', { p_session_id: live.sessionId })).error,
    ).not.toBeNull();
    expect(
      await rpc(seller.client, 'start_session', {
        p_session_id: '00000000-0000-0000-0000-000000000000',
      }),
    ).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('liberación manual: release_item, release_all_items y estados inválidos', async () => {
    const live = await createLiveSession(seller, { items: 3, releaseMode: 'manual' });
    const [i1, i2, i3] = live.itemIds as [string, string, string];
    expect((await itemRowOf(i1)).status).toBe('hidden');
    expect(await claim(b1, i1)).toMatchObject({ ok: false, code: 'item_not_available' });

    expect(await rpc(seller.client, 'release_item', { p_item_id: i1 })).toMatchObject({ ok: true });
    expect((await itemRowOf(i1)).status).toBe('available');
    expect(await rpc(seller.client, 'release_item', { p_item_id: i1 })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });

    expect(
      await rpc(seller.client, 'release_all_items', { p_session_id: live.sessionId }),
    ).toMatchObject({ ok: true, released: 2 });
    expect([(await itemRowOf(i2)).status, (await itemRowOf(i3)).status]).toEqual([
      'available',
      'available',
    ]);
  });

  it('withdraw_item rechaza los intentos abiertos y el artículo deja de aceptar claims', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    await claim(b1, itemId);
    await offer(b2, itemId, 100);
    expect(await rpc(seller.client, 'withdraw_item', { p_item_id: itemId })).toMatchObject({
      ok: true,
    });
    const item = await itemRowOf(itemId);
    expect(item).toMatchObject({ status: 'withdrawn', leader_entry_id: null, offer_count: 0 });
    expect((await entriesOf(itemId)).map((e) => e.status)).toEqual(['rejected', 'rejected']);
    expect(await claim(b3, itemId)).toMatchObject({ ok: false, code: 'item_not_available' });
    expect(await rpc(seller.client, 'withdraw_item', { p_item_id: itemId })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('post_announcement valida 1 a 200 caracteres y escribe en el feed', async () => {
    const live = await createLiveSession(seller);
    expect(
      await rpc(seller.client, 'post_announcement', {
        p_session_id: live.sessionId,
        p_text: '   ',
      }),
    ).toMatchObject({ ok: false, code: 'validation_failed' });
    expect(
      await rpc(seller.client, 'post_announcement', {
        p_session_id: live.sessionId,
        p_text: 'x'.repeat(201),
      }),
    ).toMatchObject({ ok: false, code: 'validation_failed' });
    expect(
      await rpc(seller.client, 'post_announcement', {
        p_session_id: live.sessionId,
        p_text: ' Última carta ',
      }),
    ).toMatchObject({ ok: true });
    const { data } = await admin()
      .from('session_feed')
      .select('payload')
      .eq('session_id', live.sessionId)
      .eq('type', 'announcement');
    expect(data).toEqual([{ payload: { text: 'Última carta' } }]);
  });

  it('feature_item destaca un artículo a la vez', async () => {
    const live = await createLiveSession(seller, { items: 2 });
    const [i1, i2] = live.itemIds as [string, string];
    expect(await rpc(seller.client, 'feature_item', { p_item_id: i1 })).toMatchObject({ ok: true });
    expect(await rpc(seller.client, 'feature_item', { p_item_id: i2 })).toMatchObject({ ok: true });
    expect([(await itemRowOf(i1)).is_featured, (await itemRowOf(i2)).is_featured]).toEqual([
      false,
      true,
    ]);
    expect(
      await rpc(seller.client, 'feature_item', { p_item_id: i2, p_featured: false }),
    ).toMatchObject({ ok: true });
    expect((await itemRowOf(i2)).is_featured).toBe(false);
  });

  it('end_session: rechaza intentos abiertos, limpia el estado en vivo y bloquea nuevas acciones', async () => {
    const live = await createLiveSession(seller, { items: 2, autoConfirm: false });
    const [i1, i2] = live.itemIds as [string, string];
    await claim(b1, i1);
    await claim(b2, i1);
    await offer(b3, i2, 100);
    expect(await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).toMatchObject(
      { ok: true, rejected: 3 },
    );

    const { data: session } = await admin()
      .from('claim_sessions')
      .select('status, ended_at')
      .eq('id', live.sessionId)
      .single();
    expect(session?.status).toBe('ended');
    expect(session?.ended_at).not.toBeNull();
    expect(await itemRowOf(i1)).toMatchObject({ leader_entry_id: null, offer_count: 0 });
    expect((await itemRowOf(i2)).offer_count).toBe(0);
    expect((await entriesOf(i1)).every((e) => e.status === 'rejected')).toBe(true);
    expect(await claim(b4, i1)).toMatchObject({ ok: false, code: 'session_not_live' });
    expect(await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).toMatchObject(
      { ok: false, code: 'invalid_state' },
    );
    expect(
      await rpc(seller.client, 'post_announcement', { p_session_id: live.sessionId, p_text: 'x' }),
    ).toMatchObject({ ok: false, code: 'session_not_live' });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('end_session sobre un evento no iniciado es inválido', async () => {
    const live = await createLiveSession(seller, { live: false });
    expect(await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).toMatchObject(
      { ok: false, code: 'invalid_state' },
    );
  });
});

describe('S5-03 claim_item', () => {
  it('session_not_live en un evento programado', async () => {
    const live = await createLiveSession(seller, { live: false });
    expect(await claim(b1, live.itemIds[0]!)).toMatchObject({
      ok: false,
      code: 'session_not_live',
    });
  });

  it('not_found, unauthenticated (anónimo sin permiso de ejecución) y own_session', async () => {
    const live = await createLiveSession(seller);
    expect(await claim(b1, '00000000-0000-0000-0000-000000000000')).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(
      (await anonClient().rpc('claim_item', { p_item_id: live.itemIds[0]! })).error,
    ).not.toBeNull();
    expect(await rpc(seller.client, 'claim_item', { p_item_id: live.itemIds[0]! })).toMatchObject({
      ok: false,
      code: 'own_session',
    });
  });

  it('already_in_queue y camino feliz sin auto_confirm: cola, líder y participación', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const first = await claim(b1, itemId);
    expect(first).toMatchObject({ ok: true, position: 1, won: false, item_status: 'available' });
    expect(await claim(b1, itemId)).toMatchObject({ ok: false, code: 'already_in_queue' });
    expect(await claim(b2, itemId)).toMatchObject({ ok: true, position: 2, won: false });

    const item = await itemRowOf(itemId);
    expect(item.leader_entry_id).toBe(first.entry_id);
    expect(item.leader_user_id).toBe(b1.user.id);
    expect(item.leader_display_name).toBe(b1.user.displayName);
    expect(item.leader_handle).toBeTruthy();
    expect(item.leader_wins_count).toBe(0);
    expect(item.status).toBe('available');

    const entries = await entriesOf(itemId);
    expect(entries.map((e) => e.status)).toEqual(['queued', 'queued']);
    expect(entries[0]!.seq).toBeLessThan(entries[1]!.seq);
    const { data: feed } = await admin()
      .from('session_feed')
      .select('type')
      .eq('session_id', live.sessionId)
      .eq('type', 'item_claimed');
    expect(feed).toHaveLength(1); // solo el primero de la cola emite item_claimed
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('camino feliz con auto_confirm: adjudica de inmediato', async () => {
    const live = await createLiveSession(seller, { priceCents: 20_000 });
    const itemId = live.itemIds[0]!;
    const before = await statsOf(b3.user.id);
    const sellerBefore = await statsOf(seller.user.id);
    expect(await claim(b3, itemId)).toMatchObject({
      ok: true,
      position: 1,
      won: true,
      item_status: 'sold',
    });

    const item = await itemRowOf(itemId);
    expect(item).toMatchObject({ status: 'sold', leader_entry_id: null, offer_count: 0 });
    const { data: win } = await admin()
      .from('claim_wins')
      .select('*')
      .eq('item_id', itemId)
      .single();
    expect(win).toMatchObject({
      buyer_id: b3.user.id,
      seller_id: seller.user.id,
      won_via: 'claim',
      price_cents: 20_000,
      session_id: live.sessionId,
    });
    expect((await entriesOf(itemId)).map((e) => e.status)).toEqual(['accepted']);
    expect((await statsOf(b3.user.id)).wins_count).toBe(before.wins_count + 1);
    expect((await statsOf(b3.user.id)).sessions_participated).toBe(
      before.sessions_participated + 1,
    );
    expect((await statsOf(seller.user.id)).wins_sold).toBe(sellerBefore.wins_sold + 1);
    expect(await claim(b4, itemId)).toMatchObject({ ok: false, code: 'item_not_available' });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('rate_limited a partir del intento 21 en 60 s dentro del mismo evento', async () => {
    const live = await createLiveSession(seller, { items: 21, autoConfirm: false });
    for (const itemId of live.itemIds.slice(0, 20)) {
      expect(await claim(b4, itemId)).toMatchObject({ ok: true });
    }
    expect(await claim(b4, live.itemIds[20]!)).toMatchObject({ ok: false, code: 'rate_limited' });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });
});

describe('S5-04 adjudicación y cola', () => {
  it('cola de 4: rechazo promueve por seq, retirar un no líder no cambia el líder, confirmar marca superseded', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const r1 = await claim(b1, itemId);
    const r2 = await claim(b2, itemId);
    const r3 = await claim(b3, itemId);
    const r4 = await claim(b4, itemId);
    expect([r1.position, r2.position, r3.position, r4.position]).toEqual([1, 2, 3, 4]);

    expect(await rpc(seller.client, 'reject_entry', { p_entry_id: r1.entry_id })).toMatchObject({
      ok: true,
    });
    let item = await itemRowOf(itemId);
    expect(item.leader_entry_id).toBe(r2.entry_id);
    expect(item.leader_user_id).toBe(b2.user.id);

    expect(await rpc(b4.client, 'withdraw_entry', { p_entry_id: r4.entry_id })).toMatchObject({
      ok: true,
    });
    item = await itemRowOf(itemId);
    expect(item.leader_entry_id).toBe(r2.entry_id);

    // Solo se confirma al líder.
    expect(await rpc(seller.client, 'confirm_entry', { p_entry_id: r3.entry_id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
    expect(await rpc(seller.client, 'confirm_entry', { p_entry_id: r2.entry_id })).toMatchObject({
      ok: true,
    });

    const statuses = Object.fromEntries((await entriesOf(itemId)).map((e) => [e.id, e.status]));
    expect(statuses).toEqual({
      [r1.entry_id as string]: 'rejected',
      [r2.entry_id as string]: 'accepted',
      [r3.entry_id as string]: 'superseded',
      [r4.entry_id as string]: 'withdrawn',
    });
    expect(await itemRowOf(itemId)).toMatchObject({ status: 'sold', leader_entry_id: null });
    const { data: wins } = await admin()
      .from('claim_wins')
      .select('buyer_id')
      .eq('item_id', itemId);
    expect(wins).toEqual([{ buyer_id: b2.user.id }]);
    expect(await rpc(seller.client, 'confirm_entry', { p_entry_id: r2.entry_id })).toMatchObject({
      ok: false,
    });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('rechazar al único de la cola limpia el líder', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const only = await claim(b1, live.itemIds[0]!);
    await rpc(seller.client, 'reject_entry', { p_entry_id: only.entry_id });
    expect(await itemRowOf(live.itemIds[0]!)).toMatchObject({
      leader_entry_id: null,
      leader_handle: null,
    });
    expect(await claim(b1, live.itemIds[0]!)).toMatchObject({ ok: true, position: 1 }); // puede volver a entrar
  });

  it('un comprador con N artículos ganados: wins_count = N y sessions_participated = 1', async () => {
    const fresh = (await createTestBuyers(1))[0]!;
    const live = await createLiveSession(seller, { items: 3 });
    for (const itemId of live.itemIds) {
      expect(await claim(fresh, itemId)).toMatchObject({ ok: true, won: true });
    }
    const stats = await statsOf(fresh.user.id);
    expect(stats.wins_count).toBe(3);
    expect(stats.sessions_participated).toBe(1);
    const { data: wins } = await admin()
      .from('claim_wins')
      .select('id')
      .eq('buyer_id', fresh.user.id);
    expect(wins).toHaveLength(3);
    expect(await auditUserStats(fresh.user.id)).toEqual([]);
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('withdraw_entry: solo el dueño del intento y solo si sigue abierto', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const r1 = await claim(b1, itemId);
    expect(await rpc(b2.client, 'withdraw_entry', { p_entry_id: r1.entry_id })).toMatchObject({
      ok: false,
      code: 'forbidden',
    });
    expect(await rpc(b1.client, 'withdraw_entry', { p_entry_id: r1.entry_id })).toMatchObject({
      ok: true,
    });
    expect(await rpc(b1.client, 'withdraw_entry', { p_entry_id: r1.entry_id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
    expect(await itemRowOf(itemId)).toMatchObject({ leader_entry_id: null });
  });
});

describe('S5-05 ofertas', () => {
  it('rechaza montos inválidos, mantiene una oferta activa por comprador y no emite el monto en el feed', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const itemId = live.itemIds[0]!;
    expect(await offer(b1, itemId, 10_000)).toMatchObject({ ok: false, code: 'invalid_amount' });
    expect(await offer(b1, itemId, 12_000)).toMatchObject({ ok: false, code: 'invalid_amount' });
    expect(await offer(b1, itemId, 0)).toMatchObject({ ok: false, code: 'invalid_amount' });
    expect(
      await rpc(seller.client, 'make_offer', { p_item_id: itemId, p_amount_cents: 5_000 }),
    ).toMatchObject({ ok: false, code: 'own_session' });

    const first = await offer(b1, itemId, 5_000);
    const second = await offer(b1, itemId, 6_000);
    expect(first.ok && second.ok).toBe(true);
    await offer(b2, itemId, 4_000);
    expect((await itemRowOf(itemId)).offer_count).toBe(2);
    const statuses = (await entriesOf(itemId))
      .filter((e) => e.buyer_id === b1.user.id)
      .map((e) => e.status);
    expect(statuses).toEqual(['withdrawn', 'pending']);

    const { data: feed } = await admin()
      .from('session_feed')
      .select('payload, type')
      .eq('session_id', live.sessionId)
      .eq('type', 'item_offer');
    expect(feed).toHaveLength(3);
    expect(JSON.stringify(feed)).not.toMatch(/5000|6000|4000/);
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('una oferta no bloquea el artículo: se puede reclamar con ofertas pendientes', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const itemId = live.itemIds[0]!;
    await offer(b1, itemId, 5_000);
    expect(await claim(b2, itemId)).toMatchObject({ ok: true, position: 1 });
    expect(await itemRowOf(itemId)).toMatchObject({ offer_count: 1, leader_user_id: b2.user.id });
  });

  it('aceptar una oferta supera claims y otras ofertas; won_via offer y precio = monto ofertado', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const itemId = live.itemIds[0]!;
    const winnerBefore = await statsOf(b3.user.id);
    await claim(b1, itemId);
    await offer(b2, itemId, 4_000);
    const winning = await offer(b3, itemId, 7_000);

    expect(
      await rpc(seller.client, 'accept_offer', { p_entry_id: winning.entry_id }),
    ).toMatchObject({ ok: true });
    const { data: win } = await admin()
      .from('claim_wins')
      .select('buyer_id, won_via, price_cents')
      .eq('item_id', itemId)
      .single();
    expect(win).toEqual({ buyer_id: b3.user.id, won_via: 'offer', price_cents: 7_000 });
    const byBuyer = Object.fromEntries(
      (await entriesOf(itemId)).map((e) => [e.buyer_id, e.status]),
    );
    expect(byBuyer).toEqual({
      [b1.user.id]: 'superseded',
      [b2.user.id]: 'superseded',
      [b3.user.id]: 'accepted',
    });
    expect(await itemRowOf(itemId)).toMatchObject({
      status: 'sold',
      offer_count: 0,
      leader_entry_id: null,
    });
    expect((await statsOf(b3.user.id)).wins_count).toBe(winnerBefore.wins_count + 1);

    expect(await claim(b4, itemId)).toMatchObject({ ok: false, code: 'item_not_available' });
    expect(await offer(b4, itemId, 100)).toMatchObject({ ok: false, code: 'item_not_available' });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('reject_offer recalcula offer_count; accept_offer/reject_offer solo sobre ofertas', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const itemId = live.itemIds[0]!;
    const c = await claim(b1, itemId);
    const o = await offer(b2, itemId, 3_000);
    expect(await rpc(seller.client, 'accept_offer', { p_entry_id: c.entry_id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
    expect(await rpc(seller.client, 'reject_entry', { p_entry_id: o.entry_id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
    expect(await rpc(seller.client, 'reject_offer', { p_entry_id: o.entry_id })).toMatchObject({
      ok: true,
    });
    expect(await itemRowOf(itemId)).toMatchObject({ offer_count: 0, leader_user_id: b1.user.id });
    expect(await rpc(seller.client, 'reject_offer', { p_entry_id: o.entry_id })).toMatchObject({
      ok: false,
      code: 'invalid_state',
    });
  });

  it('el vendedor ajeno no puede resolver intentos', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const c = await claim(b1, live.itemIds[0]!);
    const o = await offer(b2, live.itemIds[0]!, 3_000);
    expect(
      await rpc(otherSeller.client, 'confirm_entry', { p_entry_id: c.entry_id }),
    ).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await rpc(otherSeller.client, 'reject_entry', { p_entry_id: c.entry_id })).toMatchObject(
      { ok: false, code: 'forbidden' },
    );
    expect(await rpc(otherSeller.client, 'accept_offer', { p_entry_id: o.entry_id })).toMatchObject(
      { ok: false, code: 'forbidden' },
    );
    expect(await rpc(otherSeller.client, 'reject_offer', { p_entry_id: o.entry_id })).toMatchObject(
      { ok: false, code: 'forbidden' },
    );
    expect(await rpc(b1.client, 'confirm_entry', { p_entry_id: c.entry_id })).toMatchObject({
      ok: false,
      code: 'forbidden',
    });
  });
});

describe('S5-07 permisos y RLS', () => {
  it('el comprador lee solo sus intentos; el vendedor, los de su evento; el público, ninguno', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    await claim(b1, itemId);
    await claim(b2, itemId);

    const mine = await b1.client.from('claim_entries').select('buyer_id').eq('item_id', itemId);
    expect(mine.data).toEqual([{ buyer_id: b1.user.id }]);
    const all = await seller.client.from('claim_entries').select('buyer_id').eq('item_id', itemId);
    expect(all.data).toHaveLength(2);
    expect(
      (await otherSeller.client.from('claim_entries').select('id').eq('item_id', itemId)).data,
    ).toEqual([]);
    for (const table of ['claim_entries', 'claim_wins', 'session_participants']) {
      const res = await anonClient().from(table).select('*').limit(1);
      expect(res.data ?? []).toEqual([]); // sin grant: error de permisos o vacío
    }
    expect((await b1.client.from('session_participants').select('*').limit(1)).data ?? []).toEqual(
      [],
    );
  });

  it('claim_wins: comprador y vendedor las ven; terceros no', async () => {
    const live = await createLiveSession(seller);
    await claim(b2, live.itemIds[0]!);
    expect(
      (await b2.client.from('claim_wins').select('id').eq('item_id', live.itemIds[0]!)).data,
    ).toHaveLength(1);
    expect(
      (await seller.client.from('claim_wins').select('id').eq('item_id', live.itemIds[0]!)).data,
    ).toHaveLength(1);
    expect(
      (await b3.client.from('claim_wins').select('id').eq('item_id', live.itemIds[0]!)).data,
    ).toEqual([]);
    expect(
      (await otherSeller.client.from('claim_wins').select('id').eq('item_id', live.itemIds[0]!))
        .data,
    ).toEqual([]);
  });

  it('ninguna tabla del motor admite escritura directa de usuarios', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const entry = await claim(b1, itemId);
    const direct = {
      session_id: live.sessionId,
      item_id: itemId,
      buyer_id: b2.user.id,
      kind: 'claim',
      amount_cents: 1,
      status: 'accepted',
    };
    expect((await b2.client.from('claim_entries').insert(direct)).error).not.toBeNull();
    expect(
      (
        await b1.client
          .from('claim_entries')
          .update({ status: 'accepted' })
          .eq('id', entry.entry_id as string)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b1.client
          .from('claim_entries')
          .delete()
          .eq('id', entry.entry_id as string)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await seller.client.from('claim_wins').insert({
          item_id: itemId,
          session_id: live.sessionId,
          seller_id: seller.user.id,
          buyer_id: b1.user.id,
          entry_id: entry.entry_id,
          won_via: 'claim',
          price_cents: 1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b1.client
          .from('session_participants')
          .insert({ session_id: live.sessionId, user_id: b1.user.id })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await seller.client
          .from('session_feed')
          .insert({ session_id: live.sessionId, type: 'announcement' })
      ).error,
    ).not.toBeNull();
    expect(
      (await seller.client.from('session_feed').delete().eq('session_id', live.sessionId)).error,
    ).not.toBeNull();
    // El estado en vivo del artículo tampoco: el dueño no puede tocar status ni leader_*.
    expect(
      (await seller.client.from('claim_items').update({ status: 'sold' }).eq('id', itemId)).error,
    ).not.toBeNull();
    expect(
      (await seller.client.from('claim_items').update({ offer_count: 9 }).eq('id', itemId)).error,
    ).not.toBeNull();
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('las funciones internas no son invocables por anon ni authenticated; el anónimo lee el feed público', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const entry = await claim(b1, live.itemIds[0]!);
    for (const [fn, args] of [
      ['award_item', { p_entry_id: entry.entry_id }],
      ['recompute_item_state', { p_item_id: live.itemIds[0] }],
      ['audit_session', { p_session_id: live.sessionId }],
      ['audit_user_stats', { p_user_id: b1.user.id }],
    ] as const) {
      expect((await b1.client.rpc(fn, args)).error).not.toBeNull();
      expect((await anonClient().rpc(fn, args)).error).not.toBeNull();
    }
    const feed = await anonClient()
      .from('session_feed')
      .select('type')
      .eq('session_id', live.sessionId);
    expect((feed.data ?? []).length).toBeGreaterThan(0);
    expect(
      await b1.client.from('claim_entries').select('id').eq('item_id', live.itemIds[0]!),
    ).toMatchObject({ error: null });
  });
});

describe('S5-11 auditoría de invariantes', () => {
  it('audit_user_stats detecta un contador alterado a propósito', async () => {
    const buyer = (await createTestBuyers(1))[0]!;
    expect(await auditUserStats(buyer.user.id)).toEqual([]);
    expect(
      (
        await admin().rpc('bump_stat', {
          p_user_id: buyer.user.id,
          p_column: 'wins_count',
          p_delta: 3,
        })
      ).error,
    ).toBeNull();
    expect(await auditUserStats(buyer.user.id)).toEqual([
      { metric: 'wins_count', stored: 3, actual: 0 },
    ]);
    await admin().rpc('bump_stat', {
      p_user_id: buyer.user.id,
      p_column: 'wins_count',
      p_delta: -3,
    });
    expect(await auditUserStats(buyer.user.id)).toEqual([]);
  });

  it('audit_session detecta un contador de ofertas y un líder corruptos', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    await claim(b1, itemId);
    expect(await auditSession(live.sessionId)).toEqual([]);

    await admin().from('claim_items').update({ offer_count: 5 }).eq('id', itemId);
    const violations = (await auditSession(live.sessionId)).map((v) => v.violation);
    expect(violations).toContain('offer_count_mismatch');

    await admin()
      .from('claim_items')
      .update({ offer_count: 0, leader_entry_id: null })
      .eq('id', itemId);
    expect((await auditSession(live.sessionId)).map((v) => v.violation)).toContain(
      'leader_mismatch',
    );
  });
});
