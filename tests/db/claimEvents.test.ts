import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient, type AnyClient } from '../helpers/supabase';
import { createTestUser, signInAs, type TestUser } from '../helpers/users';
import { createTestSeller, itemRow, sessionRow, type TestSeller } from '../helpers/claims';

// S4-01/02/03/06 contra la BD en línea (migraciones 04 a 07): esquema, RLS, storage y RPC de eventos.

const WEBP = () => new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'image/webp' });
const uploaded: string[] = [];

afterAll(async () => {
  if (uploaded.length) await adminClient().storage.from('item-images').remove(uploaded);
});

// Un par de vendedores y un comprador compartidos: cada inicio de sesión cuenta contra el límite de Auth.
let sellerA: TestSeller;
let sellerB: TestSeller;
let buyerClient: AnyClient;
let buyerUser: TestUser;

beforeAll(async () => {
  sellerA = await createTestSeller();
  sellerB = await createTestSeller();
  buyerUser = await createTestUser();
  buyerClient = await signInAs(buyerUser);
});

async function draftWithItems(itemCount = 2) {
  const seller = sellerA;
  const { data: session, error } = await seller.client
    .from('claim_sessions')
    .insert(sessionRow(seller.user.id))
    .select('*')
    .single();
  expect(error).toBeNull();
  const items = [];
  for (let i = 1; i <= itemCount; i++) {
    const { data, error: itemError } = await seller.client
      .from('claim_items')
      .insert(itemRow(session!.id, i))
      .select('*')
      .single();
    expect(itemError).toBeNull();
    items.push(data!);
  }
  return { seller, session: session!, items };
}

describe('claim_sessions: creación y restricciones', () => {
  it('genera código de 8 caracteres, hereda is_test y arranca en draft', async () => {
    const { session } = await draftWithItems(0);
    expect(session.code).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
    expect(session.status).toBe('draft');
    expect(session.is_test).toBe(true);
  });

  it('rechaza valores fuera de rango y no permite fijar code/status/is_test al crear', async () => {
    const seller = sellerA;
    const bad = (patch: Record<string, unknown>) =>
      seller.client.from('claim_sessions').insert(sessionRow(seller.user.id, patch));
    expect((await bad({ title: 'ab' })).error?.code).toBe('23514');
    expect((await bad({ close_deadline_hours: 169 })).error?.code).toBe('23514');
    expect((await bad({ payment_deadline_hours: 337 })).error?.code).toBe('23514');
    expect((await bad({ shipping_deadline_hours: 23 })).error?.code).toBe('23514');
    expect((await bad({ status: 'live' })).error).not.toBeNull();
    expect((await bad({ code: 'AAAAAAAA' })).error).not.toBeNull();
    expect((await bad({ is_test: false })).error).not.toBeNull();
  });

  it('no se puede crear un evento a nombre de otro vendedor ni sin ser vendedor', async () => {
    const a = sellerA;
    const b = sellerB;
    const asB = await a.client.from('claim_sessions').insert(sessionRow(b.user.id));
    expect(asB.error).not.toBeNull();
    const buyer = buyerUser;
    expect(
      (await buyerClient.from('claim_sessions').insert(sessionRow(buyer.id))).error,
    ).not.toBeNull();
  });
});

describe('claim_items: restricciones', () => {
  it('posición única por evento, precio no negativo (0 solo en borrador, migración 27) y attributes objeto', async () => {
    const { seller, session } = await draftWithItems(1);
    const dup = await seller.client.from('claim_items').insert(itemRow(session.id, 1));
    expect(dup.error?.code).toBe('23505');
    const price = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 2, { price_cents: -1 }));
    expect(price.error?.code).toBe('23514');
    const attrs = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 2, { attributes: [] }));
    expect(attrs.error?.code).toBe('23514');
  });
});

describe('transiciones de estado inválidas', () => {
  it('claim_sessions: draft → live y ended → draft se rechazan (service role también)', async () => {
    const { session } = await draftWithItems(0);
    const admin = adminClient();
    const toLive = await admin
      .from('claim_sessions')
      .update({ status: 'live' })
      .eq('id', session.id);
    expect(toLive.error?.code).toBe('23514');
    await admin.from('claim_sessions').update({ status: 'cancelled' }).eq('id', session.id);
    const back = await admin
      .from('claim_sessions')
      .update({ status: 'draft' })
      .eq('id', session.id);
    expect(back.error?.code).toBe('23514');
  });

  it('claim_items: sold → available se rechaza', async () => {
    const { items } = await draftWithItems(1);
    const admin = adminClient();
    const item = items[0]!;
    expect(
      (await admin.from('claim_items').update({ status: 'available' }).eq('id', item.id)).error,
    ).toBeNull();
    expect(
      (await admin.from('claim_items').update({ status: 'sold' }).eq('id', item.id)).error,
    ).toBeNull();
    const back = await admin.from('claim_items').update({ status: 'available' }).eq('id', item.id);
    expect(back.error?.code).toBe('23514');
  });
});

describe('claim_entries: únicos parciales', () => {
  it('un solo accepted por artículo; un claim queued/accepted por comprador', async () => {
    const { session, items } = await draftWithItems(1);
    const item = items[0]!;
    const b1 = buyerUser;
    const b2 = sellerB.user;
    const admin = adminClient();
    const entry = (buyer: string, patch: object = {}) => ({
      session_id: session.id,
      item_id: item.id,
      buyer_id: buyer,
      kind: 'claim',
      amount_cents: 15_000,
      status: 'queued',
      ...patch,
    });
    expect((await admin.from('claim_entries').insert(entry(b1.id))).error).toBeNull();
    const dupClaim = await admin.from('claim_entries').insert(entry(b1.id));
    expect(dupClaim.error?.code).toBe('23505');
    expect(
      (await admin.from('claim_entries').insert(entry(b1.id, { status: 'rejected' }))).error,
    ).toBeNull();
    expect(
      (await admin.from('claim_entries').insert(entry(b2.id, { status: 'accepted' }))).error,
    ).toBeNull();
    const second = await admin
      .from('claim_entries')
      .insert(entry(b1.id, { status: 'accepted', kind: 'offer' }));
    expect(second.error?.code).toBe('23505');
  });
});

describe('RLS de eventos y artículos', () => {
  it('el público solo ve eventos publicados y artículos no ocultos o preview', async () => {
    const { seller, session, items } = await draftWithItems(2);
    const anon = anonClient();

    expect((await anon.from('claim_sessions').select('id').eq('id', session.id)).data).toEqual([]);
    expect((await anon.from('claim_items').select('id').eq('session_id', session.id)).data).toEqual(
      [],
    );

    await seller.client.from('claim_items').update({ is_preview: true }).eq('id', items[0]!.id);
    const pub = await seller.client.rpc('publish_session', { p_session_id: session.id });
    expect(pub.data).toMatchObject({ ok: true });

    const sess = await anon.from('claim_sessions').select('id, status').eq('id', session.id);
    expect(sess.data).toEqual([{ id: session.id, status: 'scheduled' }]);
    const visible = await anon.from('claim_items').select('id').eq('session_id', session.id);
    expect(visible.data).toEqual([{ id: items[0]!.id }]);
  });

  it('un cancelado deja de ser público', async () => {
    const { seller, session } = await draftWithItems(1);
    await seller.client.rpc('publish_session', { p_session_id: session.id });
    expect(
      (await seller.client.rpc('cancel_session', { p_session_id: session.id })).data,
    ).toMatchObject({ ok: true });
    expect(
      (await anonClient().from('claim_sessions').select('id').eq('id', session.id)).data,
    ).toEqual([]);
  });

  it('el vendedor A no lee ni edita eventos o artículos de B', async () => {
    const a = await draftWithItems(1);
    const b = sellerB;

    expect(
      (await b.client.from('claim_sessions').select('id').eq('id', a.session.id)).data,
    ).toEqual([]);
    expect(
      (await b.client.from('claim_items').select('id').eq('session_id', a.session.id)).data,
    ).toEqual([]);

    await b.client.from('claim_sessions').update({ title: 'Hackeado' }).eq('id', a.session.id);
    await b.client.from('claim_items').update({ title: 'Hackeado' }).eq('id', a.items[0]!.id);
    await b.client.from('claim_items').delete().eq('id', a.items[0]!.id);
    const { data: still } = await adminClient()
      .from('claim_sessions')
      .select('title')
      .eq('id', a.session.id)
      .single();
    const { data: item } = await adminClient()
      .from('claim_items')
      .select('title')
      .eq('id', a.items[0]!.id)
      .single();
    expect(still?.title).toBe('Claim de prueba');
    expect(item?.title).toBe('Carta 1');

    const insert = await b.client.from('claim_items').insert(itemRow(a.session.id, 9));
    expect(insert.error).not.toBeNull();
  });

  it('nadie escribe directo en entries, wins, participants ni feed', async () => {
    const { seller, session, items } = await draftWithItems(1);
    const buyer = buyerUser;
    for (const client of [seller.client, buyerClient, anonClient()]) {
      const entry = await client.from('claim_entries').insert({
        session_id: session.id,
        item_id: items[0]!.id,
        buyer_id: buyer.id,
        kind: 'claim',
        amount_cents: 1,
        status: 'queued',
      });
      expect(entry.error).not.toBeNull();
      expect((await client.from('claim_wins').insert({})).error).not.toBeNull();
      expect(
        (
          await client
            .from('session_participants')
            .insert({ session_id: session.id, user_id: buyer.id })
        ).error,
      ).not.toBeNull();
      expect(
        (await client.from('session_feed').insert({ session_id: session.id, type: 'announcement' }))
          .error,
      ).not.toBeNull();
    }
    expect((await anonClient().from('claim_entries').select('id')).error).not.toBeNull();
    expect((await anonClient().from('claim_wins').select('id')).error).not.toBeNull();
  });

  it('campos de estado en vivo y bloqueados tras publicar no son editables', async () => {
    const { seller, session, items } = await draftWithItems(1);
    const item = items[0]!;

    for (const patch of [
      { status: 'available' },
      { offer_count: 5 },
      { leader_user_id: seller.user.id },
      { is_featured: true },
    ]) {
      expect(
        (await seller.client.from('claim_items').update(patch).eq('id', item.id)).error,
      ).not.toBeNull();
    }
    for (const patch of [
      { status: 'live' },
      { code: 'ZZZZZZZZ' },
      { is_test: false },
      { started_at: new Date().toISOString() },
    ]) {
      expect(
        (await seller.client.from('claim_sessions').update(patch).eq('id', session.id)).error,
      ).not.toBeNull();
    }

    // En draft, release_mode y plazos sí se editan; tras publicar, no.
    expect(
      (
        await seller.client
          .from('claim_sessions')
          .update({ release_mode: 'manual', payment_deadline_hours: 72 })
          .eq('id', session.id)
      ).error,
    ).toBeNull();
    await seller.client.rpc('publish_session', { p_session_id: session.id });
    for (const patch of [
      { release_mode: 'all_at_start' },
      { auto_confirm: false },
      { allow_accumulate: true },
      { close_deadline_hours: 2 },
    ]) {
      expect(
        (await seller.client.from('claim_sessions').update(patch).eq('id', session.id)).error?.code,
      ).toBe('23514');
    }
    expect(
      (
        await seller.client
          .from('claim_sessions')
          .update({ title: 'Nuevo título', rules: 'Reglas' })
          .eq('id', session.id)
      ).error,
    ).toBeNull();
  });
});

describe('RPC: publish_session, reorder_items, cancel_session', () => {
  it('publish falla con evento incompleto y devuelve los motivos', async () => {
    const seller = sellerA;
    const { data: session } = await seller.client
      .from('claim_sessions')
      .insert(sessionRow(seller.user.id, { starts_at: new Date(Date.now() - 1000).toISOString() }))
      .select('id')
      .single();
    const empty = await seller.client.rpc('publish_session', { p_session_id: session!.id });
    expect(empty.error).toBeNull();
    expect(empty.data).toMatchObject({ ok: false, code: 'validation_failed' });
    expect(empty.data.reasons).toEqual(
      expect.arrayContaining(['no_items', 'starts_at_not_future']),
    );

    await seller.client.from('claim_items').insert(itemRow(session!.id, 1, { image_path: null }));
    const noImage = await seller.client.rpc('publish_session', { p_session_id: session!.id });
    expect(noImage.data.reasons).toContain('items_missing_image');
  });

  it('publish pasa a scheduled, solo el dueño, y no se repite', async () => {
    const { seller, session } = await draftWithItems(1);
    const other = sellerB;
    expect(
      (await other.client.rpc('publish_session', { p_session_id: session.id })).data,
    ).toMatchObject({ ok: false, code: 'forbidden' });
    const ok = await seller.client.rpc('publish_session', { p_session_id: session.id });
    expect(ok.data).toMatchObject({ ok: true, code: session.code });
    const { data } = await adminClient()
      .from('claim_sessions')
      .select('status')
      .eq('id', session.id)
      .single();
    expect(data?.status).toBe('scheduled');
    expect(
      (await seller.client.rpc('publish_session', { p_session_id: session.id })).data,
    ).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(
      (await anonClient().rpc('publish_session', { p_session_id: session.id })).error,
    ).not.toBeNull();
  });

  it('reorder_items reordena atómicamente y rechaza listas inválidas', async () => {
    const { seller, session, items } = await draftWithItems(3);
    const [a, b, c] = items.map((i) => i.id);
    const ok = await seller.client.rpc('reorder_items', {
      p_session_id: session.id,
      p_ordered_ids: [c, a, b],
    });
    expect(ok.data).toMatchObject({ ok: true });
    const { data } = await seller.client
      .from('claim_items')
      .select('id, position')
      .eq('session_id', session.id)
      .order('position');
    expect(data?.map((r) => r.id)).toEqual([c, a, b]);
    expect(data?.map((r) => r.position)).toEqual([1, 2, 3]);

    const missing = await seller.client.rpc('reorder_items', {
      p_session_id: session.id,
      p_ordered_ids: [a, b],
    });
    expect(missing.data).toMatchObject({ ok: false, code: 'validation_failed' });
    const foreign = await seller.client.rpc('reorder_items', {
      p_session_id: session.id,
      p_ordered_ids: [a, b, randomUUID()],
    });
    expect(foreign.data).toMatchObject({ ok: false, code: 'validation_failed' });
    const dup = await seller.client.rpc('reorder_items', {
      p_session_id: session.id,
      p_ordered_ids: [a, a, b],
    });
    expect(dup.data).toMatchObject({ ok: false, code: 'validation_failed' });
    const other = sellerB;
    expect(
      (
        await other.client.rpc('reorder_items', {
          p_session_id: session.id,
          p_ordered_ids: [a, b, c],
        })
      ).data,
    ).toMatchObject({ ok: false, code: 'forbidden' });
  });
});

describe('Storage: item-images', () => {
  it('escribe en su carpeta, no en la ajena; lectura pública; límites de tipo', async () => {
    const a = sellerA.user;
    const b = sellerB.user;
    const clientA = sellerA.client;
    const clientB = sellerB.client;

    const own = `${a.id}/${randomUUID()}/${randomUUID()}.webp`;
    expect(
      (await clientA.storage.from('item-images').upload(own, WEBP(), { contentType: 'image/webp' }))
        .error,
    ).toBeNull();
    uploaded.push(own);

    const foreign = `${b.id}/${randomUUID()}/x.webp`;
    expect(
      (
        await clientA.storage
          .from('item-images')
          .upload(foreign, WEBP(), { contentType: 'image/webp' })
      ).error,
    ).not.toBeNull();
    uploaded.push(foreign);

    const anonPath = `${a.id}/anon.webp`;
    expect(
      (
        await anonClient()
          .storage.from('item-images')
          .upload(anonPath, WEBP(), { contentType: 'image/webp' })
      ).error,
    ).not.toBeNull();
    uploaded.push(anonPath);

    const gif = await clientA.storage
      .from('item-images')
      .upload(`${a.id}/x.gif`, new Blob(['x'], { type: 'image/gif' }), {
        contentType: 'image/gif',
      });
    expect(gif.error).not.toBeNull();

    const { data } = anonClient().storage.from('item-images').getPublicUrl(own);
    expect((await fetch(data.publicUrl)).status).toBe(200);

    await clientB.storage.from('item-images').remove([own]);
    const present = async () =>
      (
        (
          await adminClient()
            .storage.from('item-images')
            .list(`${a.id}/${own.split('/')[1]}`)
        ).data ?? []
      ).length;
    expect(await present()).toBeGreaterThan(0);
    expect((await clientA.storage.from('item-images').remove([own])).error).toBeNull();
    expect(await present()).toBe(0);
  });
});
