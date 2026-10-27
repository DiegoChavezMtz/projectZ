import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import {
  auditSession,
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  sessionRow,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';

// S5-12 contra la BD en línea (migraciones 14 y 15): cierre programado, vigencia del guardadito y
// registro inborrable. Solo cuentas is_test.

let seller: TestSeller;
let other: TestSeller;
let buyer: TestBuyer;

beforeAll(async () => {
  seller = await createTestSeller();
  other = await createTestSeller();
  buyer = (await createTestBuyers(1))[0]!;
}, 300_000);

const admin = () => adminClient();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sessionOf(id: string) {
  const { data } = await admin().from('claim_sessions').select('*').eq('id', id).single();
  return data!;
}

describe('columnas closes_at y accumulate_days', () => {
  it('closes_at debe ser posterior a starts_at y accumulate_days estar entre 30 y 120', async () => {
    const insert = (patch: Record<string, unknown>) =>
      seller.client.from('claim_sessions').insert(sessionRow(seller.user.id, patch));
    expect(
      (await insert({ starts_at: hoursFromNow(48), closes_at: hoursFromNow(24) })).error?.code,
    ).toBe('23514');
    expect((await insert({ accumulate_days: 29 })).error?.code).toBe('23514');
    expect((await insert({ accumulate_days: 121 })).error?.code).toBe('23514');
    const ok = await insert({
      starts_at: hoursFromNow(24),
      closes_at: hoursFromNow(48),
      accumulate_days: 90,
    })
      .select('id, closes_at, accumulate_days')
      .single();
    expect(ok.error).toBeNull();
    expect(ok.data?.accumulate_days).toBe(90);
  });

  it('el valor por defecto de accumulate_days es 60', async () => {
    const { data } = await seller.client
      .from('claim_sessions')
      .insert(sessionRow(seller.user.id))
      .select('accumulate_days, closes_at')
      .single();
    expect(data).toEqual({ accumulate_days: 60, closes_at: null });
  });

  it('tras publicar, accumulate_days y closes_at no se editan directamente', async () => {
    const live = await createLiveSession(seller, { live: false });
    const direct = (patch: Record<string, unknown>) =>
      seller.client.from('claim_sessions').update(patch).eq('id', live.sessionId);
    expect((await direct({ accumulate_days: 90 })).error?.code).toBe('23514');
    expect((await direct({ closes_at: hoursFromNow(200) })).error?.code).toBe('23514');
    // En draft sí se edita como cualquier campo.
    const { data: draft } = await seller.client
      .from('claim_sessions')
      .insert(sessionRow(seller.user.id))
      .select('id')
      .single();
    expect(
      (
        await seller.client
          .from('claim_sessions')
          .update({ closes_at: hoursFromNow(72), accumulate_days: 45 })
          .eq('id', draft!.id)
      ).error,
    ).toBeNull();
  });
});

describe('set_session_close', () => {
  it('programado: acepta fechas válidas, rechaza pasadas, <= starts_at, ajenos y borradores', async () => {
    const live = await createLiveSession(seller, { live: false });
    const s = await sessionOf(live.sessionId);
    const call = (who: TestSeller | TestBuyer, closesAt: string | null) =>
      rpc(who.client, 'set_session_close', { p_session_id: live.sessionId, p_closes_at: closesAt });

    expect(await call(seller, new Date(Date.now() - 3_600_000).toISOString())).toMatchObject({
      ok: false,
      code: 'validation_failed',
    });
    expect(
      await call(seller, new Date(new Date(s.starts_at).getTime() - 1000).toISOString()),
    ).toMatchObject({ ok: false, code: 'validation_failed' });
    expect(await call(seller, s.starts_at)).toMatchObject({ ok: false, code: 'validation_failed' });
    expect(await call(other, hoursFromNow(100))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await call(buyer, hoursFromNow(100))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(
      (
        await anonClient().rpc('set_session_close', {
          p_session_id: live.sessionId,
          p_closes_at: hoursFromNow(100),
        })
      ).error,
    ).not.toBeNull();

    const closeAt = new Date(new Date(s.starts_at).getTime() + 36 * 3_600_000).toISOString();
    expect(await call(seller, closeAt)).toMatchObject({ ok: true });
    expect(new Date((await sessionOf(live.sessionId)).closes_at).toISOString()).toBe(closeAt);
    expect(await call(seller, null)).toMatchObject({ ok: true });
    expect((await sessionOf(live.sessionId)).closes_at).toBeNull();

    const { data: draft } = await seller.client
      .from('claim_sessions')
      .insert(sessionRow(seller.user.id))
      .select('id')
      .single();
    expect(
      await rpc(seller.client, 'set_session_close', {
        p_session_id: draft!.id,
        p_closes_at: hoursFromNow(100),
      }),
    ).toMatchObject({ ok: false, code: 'invalid_state' });
  });

  it('en vivo: extiende y emite session_extended; no admite quitar el cierre; terminado es inválido', async () => {
    const live = await createLiveSession(seller, { closesAt: hoursFromNow(72) });
    const first = await sessionOf(live.sessionId);
    const later = new Date(new Date(first.closes_at).getTime() + 12 * 3_600_000).toISOString();
    expect(
      await rpc(seller.client, 'set_session_close', {
        p_session_id: live.sessionId,
        p_closes_at: later,
      }),
    ).toMatchObject({ ok: true });
    expect(new Date((await sessionOf(live.sessionId)).closes_at).toISOString()).toBe(later);

    const { data: feed } = await admin()
      .from('session_feed')
      .select('payload')
      .eq('session_id', live.sessionId)
      .eq('type', 'session_extended');
    expect(feed).toHaveLength(1);
    expect(new Date(feed![0]!.payload.closes_at).toISOString()).toBe(later);

    expect(
      await rpc(seller.client, 'set_session_close', {
        p_session_id: live.sessionId,
        p_closes_at: null,
      }),
    ).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(
      await rpc(seller.client, 'set_session_close', {
        p_session_id: live.sessionId,
        p_closes_at: new Date(Date.now() - 1000).toISOString(),
      }),
    ).toMatchObject({ ok: false, code: 'validation_failed' });

    await rpc(seller.client, 'end_session', { p_session_id: live.sessionId });
    expect(
      await rpc(seller.client, 'set_session_close', {
        p_session_id: live.sessionId,
        p_closes_at: hoursFromNow(200),
      }),
    ).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(await auditSession(live.sessionId)).toEqual([]);
  });
});

describe('close_expired_sessions', () => {
  it('no es invocable por usuarios', async () => {
    expect((await seller.client.rpc('close_expired_sessions')).error).not.toBeNull();
    expect((await anonClient().rpc('close_expired_sessions')).error).not.toBeNull();
    expect(
      (
        await seller.client.rpc('internal_end_session', {
          p_session_id: '00000000-0000-0000-0000-000000000000',
          p_actor: seller.user.id,
        })
      ).error,
    ).not.toBeNull();
  });

  it('cierra solo los eventos vencidos, es idempotente y deja lo mismo que end_session', async () => {
    // Guarda: la función es global. Si hubiera un evento real vencido, no se toca desde una prueba.
    const { data: foreign } = await admin()
      .from('claim_sessions')
      .select('id')
      .eq('status', 'live')
      .eq('is_test', false)
      .not('closes_at', 'is', null)
      .lte('closes_at', new Date().toISOString());
    expect(
      foreign,
      'hay eventos reales vencidos: no se ejecuta close_expired_sessions desde pruebas',
    ).toEqual([]);

    // Debe publicarse con inicio futuro y cierre posterior: ventana corta de segundos.
    const startsAt = new Date(Date.now() + 25_000).toISOString();
    const closesAt = new Date(Date.now() + 30_000).toISOString();
    const expiring = await createLiveSession(seller, {
      items: 2,
      autoConfirm: false,
      startsAt,
      closesAt,
    });
    const notExpiring = await createLiveSession(seller, { closesAt: hoursFromNow(72) });
    const noClose = await createLiveSession(seller);
    const [i1, i2] = expiring.itemIds as [string, string];
    await rpc(buyer.client, 'claim_item', { p_item_id: i1 });
    await rpc(buyer.client, 'make_offer', { p_item_id: i2, p_amount_cents: 100 });

    // Antes del vencimiento no cierra nada de lo nuestro.
    await admin().rpc('close_expired_sessions');
    expect((await sessionOf(expiring.sessionId)).status).toBe('live');

    while (Date.now() < new Date(closesAt).getTime() + 1500) await wait(500);
    const first = await admin().rpc('close_expired_sessions');
    expect(first.error).toBeNull();
    expect((first.data as { closed: number }).closed).toBeGreaterThanOrEqual(1);

    const ended = await sessionOf(expiring.sessionId);
    expect(ended.status).toBe('ended');
    expect(ended.ended_at).not.toBeNull();
    const { data: entries } = await admin()
      .from('claim_entries')
      .select('status')
      .eq('session_id', expiring.sessionId);
    expect(entries?.map((e) => e.status)).toEqual(['rejected', 'rejected']);
    const { data: feed } = await admin()
      .from('session_feed')
      .select('payload')
      .eq('session_id', expiring.sessionId)
      .eq('type', 'session_ended');
    expect(feed).toEqual([{ payload: { rejected: 2, scheduled: true } }]);
    expect((await sessionOf(notExpiring.sessionId)).status).toBe('live');
    expect((await sessionOf(noClose.sessionId)).status).toBe('live');

    const second = await admin().rpc('close_expired_sessions');
    expect((second.data as { closed: number }).closed).toBe(0);
    expect(await auditSession(expiring.sessionId)).toEqual([]);
  }, 120_000);
});

describe('registro inborrable', () => {
  it('el contenido de claim_entries no cambia; status y resolved_at sí (también con service role)', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const claim = await rpc(buyer.client, 'claim_item', { p_item_id: itemId });
    const entryId = claim.entry_id as string;
    const update = (patch: Record<string, unknown>) =>
      admin().from('claim_entries').update(patch).eq('id', entryId);

    for (const patch of [
      { amount_cents: 1 },
      { buyer_id: seller.user.id },
      { kind: 'offer' },
      { item_id: live.itemIds[0] === itemId ? seller.user.id : itemId },
      { seq: 1 },
      { created_at: new Date(0).toISOString() },
    ]) {
      expect((await update(patch)).error, JSON.stringify(patch)).not.toBeNull();
    }
    expect(
      (await update({ status: 'withdrawn', resolved_at: new Date().toISOString() })).error,
    ).toBeNull();
  });

  it('session_feed y claim_wins no se editan', async () => {
    const live = await createLiveSession(seller);
    await rpc(buyer.client, 'claim_item', { p_item_id: live.itemIds[0] });
    expect(
      (await admin().from('session_feed').update({ payload: {} }).eq('session_id', live.sessionId))
        .error,
    ).not.toBeNull();
    expect(
      (await admin().from('claim_wins').update({ price_cents: 1 }).eq('session_id', live.sessionId))
        .error,
    ).not.toBeNull();
    expect(
      (
        await admin()
          .from('claim_wins')
          .update({ buyer_id: seller.user.id })
          .eq('session_id', live.sessionId)
      ).error,
    ).not.toBeNull();
    expect(await auditSession(live.sessionId)).toEqual([]);
  });

  it('los usuarios no pueden borrar el registro (sin privilegios) y audit_session verifica los triggers', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    await rpc(buyer.client, 'claim_item', { p_item_id: live.itemIds[0] });
    expect(
      (await buyer.client.from('claim_entries').delete().eq('session_id', live.sessionId)).error,
    ).not.toBeNull();
    expect(
      (await seller.client.from('session_feed').delete().eq('session_id', live.sessionId)).error,
    ).not.toBeNull();
    expect(
      (await seller.client.from('claim_sessions').delete().eq('id', live.sessionId)).error,
    ).not.toBeNull();
    const violations = (await auditSession(live.sessionId)).map((v) => v.violation);
    expect(violations).not.toContain('immutability_trigger_missing');
  });

  it('la limpieza de pruebas (evento is_test) sí puede borrar el evento con sus intentos', async () => {
    const live = await createLiveSession(seller, { autoConfirm: true });
    await rpc(buyer.client, 'claim_item', { p_item_id: live.itemIds[0] });
    expect(
      (await admin().from('claim_wins').delete().eq('session_id', live.sessionId)).error,
    ).toBeNull();
    expect(
      (await admin().from('claim_sessions').delete().eq('id', live.sessionId).eq('is_test', true))
        .error,
    ).toBeNull();
    const { data } = await admin()
      .from('claim_entries')
      .select('id')
      .eq('session_id', live.sessionId);
    expect(data).toEqual([]);
  });
});
