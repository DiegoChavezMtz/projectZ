import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { accountDeletionService } from '@/features/auth/services/accountDeletion.service';
import { adminClient, anonClient } from '../helpers/supabase';
import {
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';
import {
  ADDRESS,
  PNG,
  closeAndPay,
  daysFromNow,
  endedSession,
  orderById,
  processDeadlines,
  proofsOf,
  queuedCount,
} from '../helpers/fulfillment';

// S8 contra la BD en línea (migraciones 17 a 25): cuentas, cierre, pagos, entregas, plazos con reloj
// simulado, objeciones y guardadito. Solo cuentas is_test; process_deadlines(p_now) solo toca compradores is_test.

let seller: TestSeller;
let stranger: TestSeller;
let buyers: TestBuyer[];
const ACCUMULATE = { allow_accumulate: true };

beforeAll(async () => {
  seller = await createTestSeller();
  stranger = await createTestSeller();
  buyers = await createTestBuyers(3);
}, 300_000);

const admin = () => adminClient();

async function deliveryOf(id: string) {
  const { data } = await admin().from('deliveries').select('*').eq('id', id).single();
  return data!;
}

describe('S8-02/04 creación de cuentas y RLS', () => {
  it('una cuenta por comprador con subtotal correcto; end_session repetido no duplica', async () => {
    const { live, orders } = await endedSession(seller, [buyers[0]!, buyers[1]!], [1, 2]);
    expect(orders.map((o) => o.items_total_cents)).toEqual([10_000, 20_000]);
    expect(orders.every((o) => o.status === 'pending_close')).toBe(true);

    expect((await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).ok).toBe(
      false,
    );
    const again = await admin().rpc('create_session_orders', { p_session_id: live.sessionId });
    expect(again.data).toBe(0);
    const { count } = await admin()
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', live.sessionId);
    expect(count).toBe(2);
    const { data: wins } = await admin()
      .from('claim_wins')
      .select('order_id')
      .eq('session_id', live.sessionId);
    expect(wins?.every((w) => w.order_id)).toBe(true);
  });

  it('terceros y anónimos no leen cuentas; nadie escribe directo', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const order = orders[0]!;
    expect(
      (await buyers[0]!.client.from('orders').select('id').eq('id', order.id)).data,
    ).toHaveLength(1);
    expect((await seller.client.from('orders').select('id').eq('id', order.id)).data).toHaveLength(
      1,
    );
    expect(
      (await buyers[1]!.client.from('orders').select('id').eq('id', order.id)).data ?? [],
    ).toHaveLength(0);
    expect(
      (await stranger.client.from('orders').select('id').eq('id', order.id)).data ?? [],
    ).toHaveLength(0);
    expect(
      (await anonClient().from('orders').select('id').eq('id', order.id)).data ?? [],
    ).toHaveLength(0);
    for (const table of ['deliveries', 'payment_proofs', 'order_disputes', 'notification_queue']) {
      expect((await anonClient().from(table).select('*').limit(1)).data ?? []).toHaveLength(0);
    }
    const update = await buyers[0]!.client
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id)
      .select();
    expect(update.data ?? []).toHaveLength(0);
    expect(
      (
        await buyers[0]!.client.from('orders').insert({
          session_id: order.session_id,
          seller_id: order.seller_id,
          buyer_id: order.buyer_id,
          items_total_cents: 1,
          close_due_at: new Date().toISOString(),
        })
      ).error,
    ).not.toBeNull();
  });
});

describe('S8-05 cierre de cuenta y guardadito', () => {
  it('el plazo corre desde closed_at; pickup fuerza envío 0; solo el dueño cierra una vez', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!, buyers[1]!], [1, 1], {
      patch: { payment_deadline_hours: 24 },
    });
    const [o1, o2] = orders as [(typeof orders)[number], (typeof orders)[number]];
    expect(
      (
        await rpc(stranger.client, 'close_order', {
          p_order_id: o1.id,
          p_delivery_method: 'shipping',
          p_shipping_cents: 0,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await rpc(buyers[0]!.client, 'close_order', {
          p_order_id: o1.id,
          p_delivery_method: 'shipping',
          p_shipping_cents: 0,
        })
      ).code,
    ).toBe('forbidden');

    const closed = await rpc(seller.client, 'close_order', {
      p_order_id: o1.id,
      p_delivery_method: 'shipping',
      p_shipping_cents: 8_000,
    });
    expect(closed.ok).toBe(true);
    const row = await orderById(o1.id);
    expect(row.status).toBe('awaiting_payment');
    expect(row.total_cents).toBe(18_000);
    const hours =
      (new Date(row.pay_due_at!).getTime() - new Date(row.closed_at!).getTime()) / 3_600_000;
    expect(hours).toBe(24);
    expect(
      (
        await rpc(seller.client, 'close_order', {
          p_order_id: o1.id,
          p_delivery_method: 'shipping',
          p_shipping_cents: 0,
        })
      ).code,
    ).toBe('invalid_state');

    await rpc(seller.client, 'close_order', {
      p_order_id: o2.id,
      p_delivery_method: 'pickup',
      p_shipping_cents: 9_999,
    });
    expect((await orderById(o2.id)).shipping_cents).toBe(0);

    const stats = await admin()
      .from('user_stats')
      .select('orders_closed_on_time, orders_closed_late')
      .eq('user_id', seller.user.id)
      .single();
    expect(stats.data!.orders_closed_on_time).toBeGreaterThanOrEqual(2);
  });

  it('get_payment_instructions: solo el comprador de una cuenta cerrada', async () => {
    await admin()
      .from('seller_profiles')
      .update({ payment_instructions: 'CLABE 0123 Prueba' })
      .eq('user_id', seller.user.id);
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const id = orders[0]!.id;
    expect(
      (await rpc(buyers[0]!.client, 'get_payment_instructions', { p_order_id: id })).code,
    ).toBe('invalid_state');
    await rpc(seller.client, 'close_order', {
      p_order_id: id,
      p_delivery_method: 'pickup',
      p_shipping_cents: 0,
    });
    expect(
      (await rpc(buyers[0]!.client, 'get_payment_instructions', { p_order_id: id })).instructions,
    ).toBe('CLABE 0123 Prueba');
    expect((await rpc(buyers[1]!.client, 'get_payment_instructions', { p_order_id: id })).ok).toBe(
      false,
    );
    expect((await rpc(seller.client, 'get_payment_instructions', { p_order_id: id })).ok).toBe(
      false,
    );
    const pub = await anonClient()
      .from('public_seller_profiles')
      .select('*')
      .eq('slug', 'x')
      .limit(1);
    expect(JSON.stringify(pub.data ?? [])).not.toContain('payment_instructions');
  });

  it('set_order_accumulate: solo con allow_accumulate, reversible, bloqueada tras el comprobante', async () => {
    const off = await endedSession(seller, [buyers[0]!], [1]);
    await rpc(seller.client, 'close_order', {
      p_order_id: off.orders[0]!.id,
      p_delivery_method: 'shipping',
      p_shipping_cents: 5_000,
    });
    expect(
      (
        await rpc(buyers[0]!.client, 'set_order_accumulate', {
          p_order_id: off.orders[0]!.id,
          p_value: true,
        })
      ).code,
    ).toBe('invalid_state');

    const on = await endedSession(seller, [buyers[0]!], [1], { patch: ACCUMULATE });
    const id = on.orders[0]!.id;
    expect(
      (await rpc(buyers[0]!.client, 'set_order_accumulate', { p_order_id: id, p_value: true }))
        .code,
    ).toBe('invalid_state'); // sin cerrar
    await rpc(seller.client, 'close_order', {
      p_order_id: id,
      p_delivery_method: 'shipping',
      p_shipping_cents: 5_000,
    });
    const acc = await rpc(buyers[0]!.client, 'set_order_accumulate', {
      p_order_id: id,
      p_value: true,
    });
    expect([acc.total_cents, acc.shipping_cents]).toEqual([10_000, 0]);
    const back = await rpc(buyers[0]!.client, 'set_order_accumulate', {
      p_order_id: id,
      p_value: false,
    });
    expect([back.total_cents, back.shipping_cents]).toEqual([15_000, 5_000]);
    expect((await orderById(id)).accumulate).toBe(false);
    expect(
      (await rpc(buyers[1]!.client, 'set_order_accumulate', { p_order_id: id, p_value: true }))
        .code,
    ).toBe('forbidden');

    await rpc(buyers[0]!.client, 'set_order_accumulate', { p_order_id: id, p_value: true });
    await rpc(buyers[0]!.client, 'submit_payment_proof', {
      p_target: 'order',
      p_target_id: id,
      p_file_path: `${id}/${randomUUID()}.png`,
    });
    expect(
      (await rpc(buyers[0]!.client, 'set_order_accumulate', { p_order_id: id, p_value: false }))
        .code,
    ).toBe('invalid_state');
  });
});

describe('S8-03/06 comprobantes', () => {
  it('rechazo reabre el plazo (≥ 24 h), máx. 3 en revisión, ruta ajena rechazada, aceptar paga y crea la entrega', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1], {
      patch: { payment_deadline_hours: 1 },
    });
    const id = orders[0]!.id;
    await rpc(seller.client, 'close_order', {
      p_order_id: id,
      p_delivery_method: 'shipping',
      p_shipping_cents: 5_000,
    });
    const path = () => `${id}/${randomUUID()}.png`;

    expect(
      (
        await rpc(buyers[0]!.client, 'submit_payment_proof', {
          p_target: 'order',
          p_target_id: id,
          p_file_path: path(),
        })
      ).code,
    ).toBe('address_required');
    expect(
      (
        await rpc(buyers[0]!.client, 'submit_payment_proof', {
          p_target: 'order',
          p_target_id: id,
          p_file_path: `${randomUUID()}/x.png`,
          p_address: ADDRESS,
        })
      ).code,
    ).toBe('validation_failed');
    expect(
      (
        await rpc(buyers[0]!.client, 'submit_payment_proof', {
          p_target: 'order',
          p_target_id: id,
          p_file_path: path(),
          p_address: { recipient: 'x' },
        })
      ).code,
    ).toBe('validation_failed');

    const first = await rpc(buyers[0]!.client, 'submit_payment_proof', {
      p_target: 'order',
      p_target_id: id,
      p_file_path: path(),
      p_address: ADDRESS,
    });
    expect(first.ok).toBe(true);
    expect((await orderById(id)).status).toBe('payment_review');
    await rpc(buyers[0]!.client, 'submit_payment_proof', {
      p_target: 'order',
      p_target_id: id,
      p_file_path: path(),
    });
    await rpc(buyers[0]!.client, 'submit_payment_proof', {
      p_target: 'order',
      p_target_id: id,
      p_file_path: path(),
    });
    expect(
      (
        await rpc(buyers[0]!.client, 'submit_payment_proof', {
          p_target: 'order',
          p_target_id: id,
          p_file_path: path(),
        })
      ).code,
    ).toBe('limit_reached');

    expect(
      (
        await rpc(seller.client, 'review_payment_proof', {
          p_proof_id: first.proof_id,
          p_accept: false,
        })
      ).code,
    ).toBe('validation_failed');
    expect(
      (
        await rpc(stranger.client, 'review_payment_proof', {
          p_proof_id: first.proof_id,
          p_accept: true,
        })
      ).code,
    ).toBe('forbidden');
    const rejected = await rpc(seller.client, 'review_payment_proof', {
      p_proof_id: first.proof_id,
      p_accept: false,
      p_reason: 'Borroso',
    });
    expect(rejected.ok).toBe(true);
    let row = await orderById(id);
    expect(row.status).toBe('payment_review'); // aún quedan 2 en revisión
    expect(new Date(row.pay_due_at!).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);

    const pending = (await proofsOf('order_id', id)).filter((p) => p.status === 'submitted');
    expect(
      (
        await rpc(seller.client, 'review_payment_proof', {
          p_proof_id: pending[0]!.id,
          p_accept: true,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await rpc(seller.client, 'review_payment_proof', {
          p_proof_id: pending[0]!.id,
          p_accept: true,
        })
      ).code,
    ).toBe('invalid_state');
    row = await orderById(id);
    expect(row.status).toBe('paid');
    expect(row.delivery_id).not.toBeNull();
    const delivery = await deliveryOf(row.delivery_id!);
    expect([delivery.status, delivery.method, delivery.shipping_cents]).toEqual([
      'preparing',
      'shipping',
      5_000,
    ]);
    expect(delivery.address_snapshot.recipient).toBe(ADDRESS.recipient);
    const stats = await admin()
      .from('user_stats')
      .select('orders_paid_on_time')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    expect(stats.data!.orders_paid_on_time).toBeGreaterThanOrEqual(1);
  });

  it('storage: el comprador sube, comprador y vendedor firman URL, un tercero no', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const id = orders[0]!.id;
    const path = `${id}/${randomUUID()}.png`;
    const blocked = await buyers[0]!.client.storage
      .from('payment-proofs')
      .upload(path, PNG, { contentType: 'image/png' });
    expect(blocked.error).not.toBeNull(); // la cuenta aún no está cerrada
    await rpc(seller.client, 'close_order', {
      p_order_id: id,
      p_delivery_method: 'pickup',
      p_shipping_cents: 0,
    });
    expect(
      (
        await buyers[1]!.client.storage
          .from('payment-proofs')
          .upload(path, PNG, { contentType: 'image/png' })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await buyers[0]!.client.storage
          .from('payment-proofs')
          .upload(path, PNG, { contentType: 'image/png' })
      ).error,
    ).toBeNull();
    expect(
      (await buyers[0]!.client.storage.from('payment-proofs').createSignedUrl(path, 60)).data
        ?.signedUrl,
    ).toBeTruthy();
    expect(
      (await seller.client.storage.from('payment-proofs').createSignedUrl(path, 60)).data
        ?.signedUrl,
    ).toBeTruthy();
    expect(
      (await stranger.client.storage.from('payment-proofs').createSignedUrl(path, 60)).data
        ?.signedUrl,
    ).toBeFalsy();
    expect(
      (await anonClient().storage.from('payment-proofs').createSignedUrl(path, 60)).data?.signedUrl,
    ).toBeFalsy();
    expect(
      (await buyers[0]!.client.storage.from('payment-proofs').remove([path])).data ?? [],
    ).toHaveLength(0);
  });
});

describe('S8-07 entregas', () => {
  it('flujo: envío al momento → enviado → recibido; el vendedor no confirma, el comprador no envía', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1]);
    const paid = await closeAndPay(seller, buyers[0]!, orders[0]!);
    const did = paid.delivery_id!;
    expect((await rpc(buyers[0]!.client, 'mark_shipped', { p_delivery_id: did })).code).toBe(
      'forbidden',
    );
    expect((await rpc(seller.client, 'confirm_delivery', { p_delivery_id: did })).code).toBe(
      'forbidden',
    );
    expect((await rpc(buyers[0]!.client, 'confirm_delivery', { p_delivery_id: did })).code).toBe(
      'invalid_state',
    );
    const shipped = await rpc(seller.client, 'mark_shipped', {
      p_delivery_id: did,
      p_tracking_code: 'MX123',
    });
    expect(shipped.on_time).toBe(true);
    expect((await rpc(buyers[0]!.client, 'confirm_delivery', { p_delivery_id: did })).ok).toBe(
      true,
    );
    expect(
      ((await orderById(paid.id)) as unknown as { completed_at: string | null }).completed_at,
    ).not.toBeNull();
    const stats = await admin()
      .from('user_stats')
      .select('deliveries_received')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    expect(stats.data!.deliveries_received).toBeGreaterThanOrEqual(1);
  });

  it('acumulación de dos eventos del mismo vendedor en una entrega; cotización y cargo; otro vendedor no se mezcla', async () => {
    const a = await endedSession(seller, [buyers[0]!], [1], { patch: ACCUMULATE });
    const b = await endedSession(seller, [buyers[0]!], [1], { patch: ACCUMULATE });
    const foreign = await endedSession(stranger, [buyers[0]!], [1], { patch: ACCUMULATE });
    const paidA = await closeAndPay(seller, buyers[0]!, a.orders[0]!, { accumulate: true });
    const paidB = await closeAndPay(seller, buyers[0]!, b.orders[0]!, { accumulate: true });
    const paidF = await closeAndPay(stranger, buyers[0]!, foreign.orders[0]!, { accumulate: true });
    expect(paidA.delivery_id).toBeNull();
    expect(paidA.accumulate_until).not.toBeNull();

    const mixed = await rpc(buyers[0]!.client, 'request_delivery', {
      p_order_ids: [paidA.id, paidF.id],
      p_method: 'shipping',
      p_address: ADDRESS,
    });
    expect(mixed.code).toBe('invalid_state');
    expect(
      (
        await rpc(buyers[0]!.client, 'request_delivery', {
          p_order_ids: [paidA.id],
          p_method: 'shipping',
          p_address: { recipient: 'x' },
        })
      ).code,
    ).toBe('validation_failed');
    expect(
      (
        await rpc(buyers[1]!.client, 'request_delivery', {
          p_order_ids: [paidA.id],
          p_method: 'pickup',
        })
      ).code,
    ).toBe('invalid_state');

    const req = await rpc(buyers[0]!.client, 'request_delivery', {
      p_order_ids: [paidA.id, paidB.id],
      p_method: 'shipping',
      p_address: ADDRESS,
    });
    expect(req.ok).toBe(true);
    const did = req.delivery_id as string;
    expect((await orderById(paidA.id)).delivery_id).toBe(did);
    expect((await orderById(paidB.id)).delivery_id).toBe(did);
    expect(
      (
        await rpc(buyers[0]!.client, 'request_delivery', {
          p_order_ids: [paidA.id],
          p_method: 'pickup',
        })
      ).code,
    ).toBe('invalid_state');

    let d = await deliveryOf(did);
    expect([d.status, d.ship_due_at]).toEqual(['requested', null]);
    expect(
      (
        await rpc(buyers[0]!.client, 'quote_delivery', {
          p_delivery_id: did,
          p_shipping_cents: 100,
        })
      ).code,
    ).toBe('forbidden');
    expect(
      (await rpc(seller.client, 'quote_delivery', { p_delivery_id: did, p_shipping_cents: 9_000 }))
        .status,
    ).toBe('awaiting_payment');
    d = await deliveryOf(did);
    expect(d.ship_due_at).toBeNull(); // el reloj del vendedor no corre mientras haya cargo por pagar

    const proof = await rpc(buyers[0]!.client, 'submit_payment_proof', {
      p_target: 'delivery',
      p_target_id: did,
      p_file_path: `${did}/${randomUUID()}.pdf`,
    });
    expect(proof.ok).toBe(true);
    expect(
      (
        await rpc(seller.client, 'review_payment_proof', {
          p_proof_id: proof.proof_id,
          p_accept: true,
        })
      ).ok,
    ).toBe(true);
    d = await deliveryOf(did);
    expect(d.status).toBe('preparing');
    expect(d.ship_due_at).not.toBeNull();
    expect((await rpc(seller.client, 'mark_shipped', { p_delivery_id: did })).ok).toBe(true);
  });

  it('cotización en 0 pasa directo a preparing; pickup no se cotiza', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!, buyers[1]!], [1, 1], {
      patch: ACCUMULATE,
    });
    const p0 = await closeAndPay(seller, buyers[0]!, orders[0]!, { accumulate: true });
    const p1 = await closeAndPay(seller, buyers[1]!, orders[1]!, { accumulate: true });
    const r0 = await rpc(buyers[0]!.client, 'request_delivery', {
      p_order_ids: [p0.id],
      p_method: 'shipping',
      p_address: ADDRESS,
    });
    expect(
      (
        await rpc(seller.client, 'quote_delivery', {
          p_delivery_id: r0.delivery_id,
          p_shipping_cents: 0,
        })
      ).status,
    ).toBe('preparing');
    const r1 = await rpc(buyers[1]!.client, 'request_delivery', {
      p_order_ids: [p1.id],
      p_method: 'pickup',
      p_pickup_note: 'Metro Insurgentes, sábado',
    });
    expect(r1.status).toBe('preparing');
    expect(
      (
        await rpc(seller.client, 'quote_delivery', {
          p_delivery_id: r1.delivery_id,
          p_shipping_cents: 10,
        })
      ).code,
    ).toBe('invalid_state');
  });
});

describe('S8-08/09 plazos con reloj simulado y objeciones', () => {
  it('recordatorio único, impago idempotente, pago en revisión no vence, objeción y resolución', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!, buyers[1]!], [1, 1]);
    const [unpaid, reviewing] = orders as [(typeof orders)[number], (typeof orders)[number]];
    for (const o of [unpaid, reviewing]) {
      await rpc(seller.client, 'close_order', {
        p_order_id: o.id,
        p_delivery_method: 'pickup',
        p_shipping_cents: 0,
      });
    }
    await rpc(buyers[1]!.client, 'submit_payment_proof', {
      p_target: 'order',
      p_target_id: reviewing.id,
      p_file_path: `${reviewing.id}/${randomUUID()}.png`,
    });

    const statsBefore = await admin()
      .from('user_stats')
      .select('orders_unpaid')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    const row = await orderById(unpaid.id);
    const dueMs = new Date(row.pay_due_at!).getTime();
    const reminderAt = new Date(dueMs - 6 * 3_600_000);
    await processDeadlines(reminderAt);
    await processDeadlines(reminderAt);
    const { count: reminders } = await admin()
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('dedupe_key', `paymentReminder:${unpaid.id}`);
    expect(reminders).toBe(1);

    const late = new Date(dueMs + 3_600_000);
    await processDeadlines(late);
    const second = await processDeadlines(late);
    expect(second.unpaid).toBe(0);
    expect((await orderById(unpaid.id)).status).toBe('unpaid');
    expect((await orderById(reviewing.id)).status).toBe('payment_review');
    expect(
      await queuedCount('unpaidNotice', [buyers[0]!.user.id, seller.user.id]),
    ).toBeGreaterThanOrEqual(2);
    const stats = await admin()
      .from('user_stats')
      .select('orders_unpaid')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    expect(stats.data!.orders_unpaid).toBeGreaterThan(statsBefore.data!.orders_unpaid);

    expect(
      (await rpc(buyers[1]!.client, 'object_unpaid', { p_order_id: unpaid.id, p_note: 'x' })).code,
    ).toBe('not_found');
    expect(
      (await rpc(buyers[0]!.client, 'object_unpaid', { p_order_id: unpaid.id, p_note: '' })).code,
    ).toBe('validation_failed');
    expect(
      (
        await rpc(buyers[0]!.client, 'object_unpaid', {
          p_order_id: unpaid.id,
          p_note: 'Pagué por otro medio',
        })
      ).ok,
    ).toBe(true);
    expect(
      (await rpc(buyers[0]!.client, 'object_unpaid', { p_order_id: unpaid.id, p_note: 'otra' }))
        .code,
    ).toBe('already_exists');
    const pub = await anonClient()
      .from('public_disputes')
      .select('note, status')
      .eq('order_id', unpaid.id);
    expect(pub.data).toEqual([{ note: 'Pagué por otro medio', status: 'open' }]);
    const ev = await admin()
      .from('reputation_events')
      .select('status')
      .eq('order_id', unpaid.id)
      .eq('kind', 'unpaid')
      .single();
    expect(ev.data!.status).toBe('disputed');

    // La resolución solo la ejecuta el service role.
    expect(
      (
        await rpc(buyers[0]!.client, 'admin_resolve_dispute', {
          p_order_id: unpaid.id,
          p_resolution: 'revoked',
        }).catch(() => ({ ok: false }))
      ).ok,
    ).toBe(false);
    const resolved = await admin().rpc('admin_resolve_dispute', {
      p_order_id: unpaid.id,
      p_resolution: 'revoked',
      p_note: 'Verificado',
    });
    expect(resolved.data.ok).toBe(true);
    expect((await orderById(unpaid.id)).status).toBe('cancelled');
    const after = await admin()
      .from('user_stats')
      .select('orders_unpaid')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    expect(after.data!.orders_unpaid).toBe(stats.data!.orders_unpaid - 1);
    expect(
      (await anonClient().from('public_disputes').select('note').eq('order_id', unpaid.id)).data ??
        [],
    ).toHaveLength(0);
  });

  it('process_deadlines con p_now exige service role', async () => {
    const result = await rpc(buyers[0]!.client, 'process_deadlines', {
      p_now: new Date().toISOString(),
    }).catch((e) => e);
    expect(result).toBeInstanceOf(Error);
  });

  it('confirmación automática a los 7 días sin evento received', async () => {
    const { orders } = await endedSession(seller, [buyers[2]!], [1]);
    const paid = await closeAndPay(seller, buyers[2]!, orders[0]!);
    const shipped = await rpc(seller.client, 'mark_shipped', { p_delivery_id: paid.delivery_id });
    expect(shipped.ok).toBe(true);
    const before = await admin()
      .from('user_stats')
      .select('deliveries_received')
      .eq('user_id', buyers[2]!.user.id)
      .single();
    await processDeadlines(daysFromNow(8));
    expect((await deliveryOf(paid.delivery_id!)).status).toBe('delivered');
    const after = await admin()
      .from('user_stats')
      .select('deliveries_received')
      .eq('user_id', buyers[2]!.user.id)
      .single();
    expect(after.data!.deliveries_received).toBe(before.data!.deliveries_received);
  });
});

describe('S8-17 guardadito: vigencia y liberación', () => {
  it('aviso de 7 días único, alerta al vencer, liberación por gracia sin contar como impago', async () => {
    const { orders } = await endedSession(seller, [buyers[0]!], [1], {
      patch: { ...ACCUMULATE, accumulate_days: 30 },
    });
    const paid = await closeAndPay(seller, buyers[0]!, orders[0]!, { accumulate: true });
    const until = new Date(paid.accumulate_until!);
    expect(Math.round((until.getTime() - Date.now()) / 86_400_000)).toBe(30);

    const before = await queuedCount('accumulateReminder', [buyers[0]!.user.id]);
    const t7 = new Date(until.getTime() - 6 * 86_400_000);
    await processDeadlines(t7);
    await processDeadlines(t7);
    expect(await queuedCount('accumulateReminder', [buyers[0]!.user.id])).toBe(before + 1);

    const expired = new Date(until.getTime() + 3_600_000);
    await processDeadlines(expired);
    await processDeadlines(expired);
    let row = await admin().from('orders').select('*').eq('id', paid.id).single();
    expect(row.data!.status).toBe('paid');
    expect(row.data!.accumulate_notice_at).not.toBeNull();
    expect(new Date(row.data!.accumulate_grace_until).getTime() - until.getTime()).toBe(
      3 * 86_400_000,
    );

    const gone = new Date(until.getTime() + 3 * 86_400_000 + 3_600_000);
    await processDeadlines(gone);
    await processDeadlines(gone);
    row = await admin().from('orders').select('*').eq('id', paid.id).single();
    expect(row.data!.status).toBe('released');
    const stats = await admin()
      .from('user_stats')
      .select('orders_released, orders_unpaid')
      .eq('user_id', buyers[0]!.user.id)
      .single();
    expect(stats.data!.orders_released).toBe(
      1 + (await priorReleased(buyers[0]!.user.id, paid.id)),
    );
    const events = await admin().from('reputation_events').select('kind').eq('order_id', paid.id);
    expect(events.data!.map((e) => e.kind)).toContain('accumulate_released');
    expect(
      await queuedCount('accumulateReleased', [buyers[0]!.user.id, seller.user.id]),
    ).toBeGreaterThanOrEqual(2);
  });

  it('el comprador libera a petición; confirmar con entrega dentro de gracia; cargo impago en cuenta vencida libera', async () => {
    const e = await endedSession(seller, [buyers[1]!], [2], {
      patch: { ...ACCUMULATE, accumulate_days: 30 },
    });
    const paidA = await closeAndPay(seller, buyers[1]!, e.orders[0]!, { accumulate: true });
    const solo = await endedSession(seller, [buyers[1]!], [1], {
      patch: { ...ACCUMULATE, accumulate_days: 30 },
    });
    const paidB = await closeAndPay(seller, buyers[1]!, solo.orders[0]!, { accumulate: true });

    expect(
      (await rpc(seller.client, 'release_accumulated_order', { p_order_id: paidA.id })).code,
    ).toBe('not_found');
    expect(
      (await rpc(buyers[1]!.client, 'release_accumulated_order', { p_order_id: paidA.id })).ok,
    ).toBe(true);
    expect(
      (await rpc(buyers[1]!.client, 'release_accumulated_order', { p_order_id: paidA.id })).code,
    ).toBe('invalid_state');
    expect((await orderById(paidA.id)).status).toBe('released');

    const until = new Date(paidB.accumulate_until!);
    await processDeadlines(new Date(until.getTime() + 3_600_000)); // alerta
    const req = await rpc(buyers[1]!.client, 'request_delivery', {
      p_order_ids: [paidB.id],
      p_method: 'shipping',
      p_address: ADDRESS,
    });
    expect(req.ok).toBe(true);
    await rpc(seller.client, 'quote_delivery', {
      p_delivery_id: req.delivery_id,
      p_shipping_cents: 7_000,
    });
    const res = await processDeadlines(daysFromNow(60 + 30 + 5));
    expect(res.fees_cancelled).toBeGreaterThanOrEqual(1);
    expect((await orderById(paidB.id)).status).toBe('released');
    expect((await deliveryOf(req.delivery_id as string)).status).toBe('cancelled');
  });
});

async function priorReleased(userId: string, exceptOrderId: string) {
  const { count } = await admin()
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', userId)
    .eq('status', 'released')
    .neq('id', exceptOrderId);
  return count ?? 0;
}

describe('S8-15 bloqueos de eliminación de cuenta', () => {
  it('cuentas abiertas, guardaditos sin entrega y entregas sin completar bloquean (comprador y vendedor)', async () => {
    const [buyer, other] = await createTestBuyers(2);
    const cleanSeller = await createTestSeller();
    expect(await accountDeletionService.blockersFor(buyer!.user.id)).toEqual([]);
    expect(await accountDeletionService.blockersFor(cleanSeller.user.id)).toEqual([]);

    // Cuenta por cerrar: bloquea a ambos.
    const open = await endedSession(cleanSeller, [buyer!], [1], { patch: ACCUMULATE });
    expect(await accountDeletionService.blockersFor(buyer!.user.id)).toContain('open_orders');
    expect(await accountDeletionService.blockersFor(cleanSeller.user.id)).toContain('open_orders');
    expect(await accountDeletionService.blockersFor(other!.user.id)).toEqual([]);

    // Guardadito pagado sin entrega: sigue bloqueando.
    const paid = await closeAndPay(cleanSeller, buyer!, open.orders[0]!, { accumulate: true });
    const afterPay = await accountDeletionService.blockersFor(buyer!.user.id);
    expect(afterPay).toContain('pending_accumulate');
    expect(afterPay).not.toContain('open_orders');

    // Entrega solicitada: bloquea hasta que se complete.
    const req = await rpc(buyer!.client, 'request_delivery', {
      p_order_ids: [paid.id],
      p_method: 'pickup',
    });
    expect(await accountDeletionService.blockersFor(buyer!.user.id)).toContain('open_deliveries');
    await rpc(cleanSeller.client, 'mark_shipped', { p_delivery_id: req.delivery_id });
    await rpc(buyer!.client, 'confirm_delivery', { p_delivery_id: req.delivery_id });
    expect(await accountDeletionService.blockersFor(buyer!.user.id)).toEqual([]);
    expect(await accountDeletionService.blockersFor(cleanSeller.user.id)).toEqual([]);
  });
});
