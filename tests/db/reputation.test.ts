import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import {
  auditUserStats,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';
import {
  completeOrder,
  endedSession,
  orderById,
  processDeadlines,
  closeAndPay,
} from '../helpers/fulfillment';

// S9 contra la BD en línea (migración 26): calificaciones, vistas públicas, recordatorios y auditoría.
// Solo cuentas is_test; process_deadlines(p_now) solo toca compradores is_test.

let seller: TestSeller;
let buyers: TestBuyer[];

beforeAll(async () => {
  seller = await createTestSeller();
  buyers = await createTestBuyers(3);
}, 300_000);

const admin = () => adminClient();
const statsOf = async (userId: string) =>
  (await admin().from('user_stats').select('*').eq('user_id', userId).single()).data!;

describe('S9-01 submit_rating', () => {
  it('no se califica sin cuenta completada ni ajeno; valida estrellas, etiquetas y comentario', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const order = orders[0]!;
    const rate = (client: TestBuyer['client'], patch: Record<string, unknown> = {}) =>
      rpc(client, 'submit_rating', {
        p_order_id: order.id,
        p_stars: 5,
        p_tags: [],
        ...patch,
      });

    expect((await rate(buyers[0]!.client)).code).toBe('invalid_state');
    expect((await rate(buyers[1]!.client)).code).toBe('not_found');
    expect((await rate(buyers[0]!.client, { p_stars: 0 })).code).toBe('validation_failed');
    expect((await rate(buyers[0]!.client, { p_stars: 6 })).code).toBe('validation_failed');
    expect((await rate(buyers[0]!.client, { p_tags: ['pago_rapido'] })).code).toBe(
      'validation_failed',
    );
    expect((await rate(seller.client, { p_tags: ['envio_rapido'] })).code).toBe(
      'validation_failed',
    );
    expect((await rate(buyers[0]!.client, { p_comment: 'x'.repeat(281) })).code).toBe(
      'validation_failed',
    );
  });

  it('calificaciones mutuas: actualizan user_stats, historial y no se repiten', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const done = await completeOrder(seller, buyers[0]!, orders[0]!);
    expect(done.completed_at).not.toBeNull();

    const before = {
      seller: await statsOf(seller.user.id),
      buyer: await statsOf(buyers[0]!.user.id),
    };

    const byBuyer = await rpc(buyers[0]!.client, 'submit_rating', {
      p_order_id: done.id,
      p_stars: 5,
      p_tags: ['envio_rapido', 'envio_rapido', 'empaque_cuidadoso'],
      p_comment: '  Excelente  ',
    });
    expect(byBuyer.ok).toBe(true);
    const bySeller = await rpc(seller.client, 'submit_rating', {
      p_order_id: done.id,
      p_stars: 4,
      p_tags: ['pago_rapido'],
    });
    expect(bySeller.ok).toBe(true);

    // Una calificación por (cuenta, calificador).
    expect(
      (await rpc(buyers[0]!.client, 'submit_rating', { p_order_id: done.id, p_stars: 1 })).code,
    ).toBe('already_exists');

    const after = {
      seller: await statsOf(seller.user.id),
      buyer: await statsOf(buyers[0]!.user.id),
    };
    expect(after.seller.rating_as_seller_sum).toBe(before.seller.rating_as_seller_sum + 5);
    expect(after.seller.rating_as_seller_count).toBe(before.seller.rating_as_seller_count + 1);
    expect(after.buyer.rating_as_buyer_sum).toBe(before.buyer.rating_as_buyer_sum + 4);
    expect(after.buyer.rating_as_buyer_count).toBe(before.buyer.rating_as_buyer_count + 1);

    const { data: rating } = await admin()
      .from('ratings')
      .select('tags, comment, rater_role')
      .eq('order_id', done.id)
      .eq('rater_id', buyers[0]!.user.id)
      .single();
    expect(rating).toEqual({
      tags: ['empaque_cuidadoso', 'envio_rapido'],
      comment: 'Excelente',
      rater_role: 'buyer',
    });

    const events = await admin()
      .from('reputation_events')
      .select('user_id, role, kind, counterparty_id, payload')
      .eq('order_id', done.id)
      .eq('kind', 'rated');
    expect(events.data).toHaveLength(2);
    expect(events.data!.find((e) => e.user_id === seller.user.id)).toMatchObject({
      role: 'seller',
      counterparty_id: buyers[0]!.user.id,
    });

    expect(await auditUserStats(seller.user.id)).toEqual([]);
    expect(await auditUserStats(buyers[0]!.user.id)).toEqual([]);
  });

  it('fuera de la ventana de 14 días falla', async () => {
    const { orders } = await endedSession(seller, [buyers[1]!], [1]);
    const done = await completeOrder(seller, buyers[1]!, orders[0]!);
    const old = new Date(Date.now() - 15 * 86_400_000).toISOString();
    await admin().from('orders').update({ completed_at: old }).eq('id', done.id);
    expect(
      (await rpc(buyers[1]!.client, 'submit_rating', { p_order_id: done.id, p_stars: 5 })).code,
    ).toBe('invalid_state');
    expect(
      (await rpc(seller.client, 'submit_rating', { p_order_id: done.id, p_stars: 5 })).code,
    ).toBe('invalid_state');
  });

  it('la calificación es inmutable y no se escribe directo', async () => {
    const { data: any1 } = await admin().from('ratings').select('id, order_id').limit(1).single();
    // Service role: el trigger rechaza editar.
    const edit = await admin().from('ratings').update({ stars: 1 }).eq('id', any1!.id);
    expect(edit.error).not.toBeNull();
    // Usuarios autenticados: sin insert/update/delete.
    const insert = await buyers[0]!.client.from('ratings').insert({
      order_id: any1!.order_id,
      rater_id: buyers[0]!.user.id,
      ratee_id: seller.user.id,
      rater_role: 'buyer',
      stars: 5,
    });
    expect(insert.error).not.toBeNull();
    const del = await buyers[0]!.client.from('ratings').delete().eq('id', any1!.id);
    expect(del.error ?? (del.count ?? 0) === 0).toBeTruthy();
  });
});

describe('S9-01 pending_ratings y recordatorio', () => {
  it('lista solo cuentas completadas sin calificar y exige sesión', async () => {
    const { orders } = await endedSession(seller, [buyers[2]!], [1]);
    expect((await buyers[2]!.client.rpc('pending_ratings')).data).toEqual([]);

    const done = await completeOrder(seller, buyers[2]!, orders[0]!);
    const pending = await buyers[2]!.client.rpc('pending_ratings');
    expect(pending.data!.map((r: { order_id: string }) => r.order_id)).toContain(done.id);
    expect(pending.data![0]).toMatchObject({ my_role: 'buyer', counterparty_id: seller.user.id });

    const sellerPending = await seller.client.rpc('pending_ratings');
    expect(
      sellerPending.data!.find((r: { order_id: string }) => r.order_id === done.id),
    ).toMatchObject({
      my_role: 'seller',
    });

    expect((await anonClient().rpc('pending_ratings')).error).not.toBeNull();

    // Recordatorio a los 3 días: uno por usuario y cuenta, aunque el barrido corra dos veces.
    const at = new Date(new Date(done.completed_at!).getTime() + 4 * 86_400_000);
    await processDeadlines(at);
    await processDeadlines(at);
    const { data: queued } = await admin()
      .from('notification_queue')
      .select('user_id')
      .eq('template', 'ratingReminder')
      .like('dedupe_key', `ratingReminder:${done.id}:%`);
    expect(queued!.map((q) => q.user_id).sort()).toEqual(
      [buyers[2]!.user.id, seller.user.id].sort(),
    );

    // Antes de los 3 días no se avisa, y quien ya calificó no es candidato en la siguiente cuenta.
    expect(
      (await rpc(buyers[2]!.client, 'submit_rating', { p_order_id: done.id, p_stars: 3 })).ok,
    ).toBe(true);
    const left = await buyers[2]!.client.rpc('pending_ratings');
    expect(left.data!.map((r: { order_id: string }) => r.order_id)).not.toContain(done.id);
  });
});

describe('S9-02 vistas públicas', () => {
  it('anónimo lee estadísticas, historial y calificaciones; no escribe ni lee tablas privadas', async () => {
    const anon = anonClient();
    const handle = (
      await admin().from('profiles').select('handle').eq('id', seller.user.id).single()
    ).data!.handle;

    const stats = await anon.from('public_user_stats').select('*').eq('handle', handle).single();
    expect(stats.data).toMatchObject({
      user_id: seller.user.id,
      is_seller: true,
      is_deleted: false,
    });
    expect(stats.data!.rating_as_seller_count).toBeGreaterThan(0);

    const history = await anon
      .from('public_reputation_events')
      .select('kind, session_code, counterparty_handle')
      .eq('user_id', seller.user.id);
    expect(history.data!.length).toBeGreaterThan(0);
    expect(history.data!.some((e) => e.kind === 'rated')).toBe(true);
    expect(
      history.data!.every(
        (e) =>
          e.session_code !== null ||
          e.kind === 'delivered_on_time' ||
          e.kind === 'delivered_late' ||
          e.kind === 'received',
      ),
    ).toBe(true);

    const breakdown = await anon
      .from('public_rating_breakdown')
      .select('stars, total, rater_role')
      .eq('user_id', seller.user.id);
    expect(breakdown.data!.every((r) => r.rater_role === 'buyer')).toBe(true);
    const tags = await anon.from('public_rating_tags').select('tag').eq('user_id', seller.user.id);
    expect(tags.data!.length).toBeGreaterThan(0);

    // Escritura directa imposible; datos de cuentas y notas privadas no son legibles.
    expect(
      (await anon.from('user_stats').update({ wins_count: 999 }).eq('user_id', seller.user.id))
        .error,
    ).not.toBeNull();
    expect(
      (
        await anon
          .from('reputation_events')
          .insert({ user_id: seller.user.id, role: 'buyer', kind: 'received' })
      ).error,
    ).not.toBeNull();
    expect((await anon.from('orders').select('id').limit(1)).data ?? []).toHaveLength(0);
    expect((await anon.from('user_stats').select('user_id').limit(1)).data ?? []).toHaveLength(0);
  });

  it('objeción: visible junto a la marca; revoked oculta la marca y revierte contadores', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const order = orders[0]!;
    await rpc(seller.client, 'close_order', {
      p_order_id: order.id,
      p_delivery_method: 'shipping',
      p_shipping_cents: 5_000,
    });
    const closed = await orderById(order.id);
    await processDeadlines(new Date(new Date(closed.pay_due_at!).getTime() + 3_600_000));
    expect((await orderById(order.id)).status).toBe('unpaid');

    const anon = anonClient();
    const unpaidVisible = await anon
      .from('public_reputation_events')
      .select('status, dispute_note')
      .eq('order_id', order.id)
      .eq('kind', 'unpaid');
    expect(unpaidVisible.data).toEqual([{ status: 'active', dispute_note: null }]);

    await rpc(buyers[0]!.client, 'object_unpaid', {
      p_order_id: order.id,
      p_note: 'Pagué por otro medio',
    });
    const disputed = await anon
      .from('public_reputation_events')
      .select('status, dispute_note')
      .eq('order_id', order.id)
      .eq('kind', 'unpaid');
    expect(disputed.data).toEqual([{ status: 'disputed', dispute_note: 'Pagué por otro medio' }]);
    expect(await auditUserStats(buyers[0]!.user.id)).toEqual([]);

    await admin().rpc('admin_resolve_dispute', {
      p_order_id: order.id,
      p_resolution: 'revoked',
      p_note: 'Verificado',
    });
    const hidden = await anon
      .from('public_reputation_events')
      .select('id')
      .eq('order_id', order.id)
      .eq('kind', 'unpaid');
    expect(hidden.data ?? []).toHaveLength(0);
    expect(await auditUserStats(buyers[0]!.user.id)).toEqual([]);
  });
});

describe('S9-09 auditoría', () => {
  it('detecta una discrepancia forzada y vuelve a vacío al corregirla', async () => {
    const id = buyers[1]!.user.id;
    expect(await auditUserStats(id)).toEqual([]);
    await admin().rpc('bump_stat', { p_user_id: id, p_column: 'orders_paid_on_time', p_delta: 2 });
    await admin().rpc('bump_stat', { p_user_id: id, p_column: 'rating_as_buyer_sum', p_delta: 3 });
    const found = await auditUserStats(id);
    expect(found.map((f) => f.metric).sort()).toEqual([
      'orders_paid_on_time',
      'rating_as_buyer_sum',
    ]);
    await admin().rpc('bump_stat', { p_user_id: id, p_column: 'orders_paid_on_time', p_delta: -2 });
    await admin().rpc('bump_stat', { p_user_id: id, p_column: 'rating_as_buyer_sum', p_delta: -3 });
    expect(await auditUserStats(id)).toEqual([]);
  });

  it('closeAndPay sin completar no genera calificaciones pendientes', async () => {
    const { orders } = await endedSession(seller, [buyers[2]!], [1]);
    const paid = await closeAndPay(seller, buyers[2]!, orders[0]!);
    const pending = await buyers[2]!.client.rpc('pending_ratings');
    expect(pending.data!.map((r: { order_id: string }) => r.order_id)).not.toContain(paid.id);
  });
});
