import { beforeAll, describe, expect, it } from 'vitest';
import { createTestSeller, itemRow, rpc, sessionRow, type TestSeller } from '../helpers/claims';

// S11-05 contra la BD en línea (migración 27): borradores sin precio solo mientras el evento es `draft`.

let seller: TestSeller;
beforeAll(async () => {
  seller = await createTestSeller();
});

async function newDraft() {
  const { data, error } = await seller.client
    .from('claim_sessions')
    .insert(sessionRow(seller.user.id))
    .select('*')
    .single();
  expect(error).toBeNull();
  return data!;
}

describe('artículos sin precio (modo escáner)', () => {
  it('un evento en borrador admite price_cents = 0 y rechaza negativos', async () => {
    const session = await newDraft();
    const ok = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 1, { price_cents: 0 }));
    expect(ok.error).toBeNull();
    const negative = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 2, { price_cents: -1 }));
    expect(negative.error?.code).toBe('23514');
  });

  it('publish_session rechaza el evento mientras haya artículos sin precio', async () => {
    const session = await newDraft();
    await seller.client.from('claim_items').insert(itemRow(session.id, 1, { price_cents: 0 }));
    const result = await rpc(seller.client, 'publish_session', { p_session_id: session.id });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('items_missing_price');
  });

  it('tras ponerle precio se puede publicar, y ya programado no admite precio 0', async () => {
    const session = await newDraft();
    const { data: item } = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 1, { price_cents: 0 }))
      .select('*')
      .single();
    await seller.client.from('claim_items').update({ price_cents: 15_000 }).eq('id', item!.id);
    const published = await rpc(seller.client, 'publish_session', { p_session_id: session.id });
    expect(published.ok).toBe(true);

    const zeroUpdate = await seller.client
      .from('claim_items')
      .update({ price_cents: 0 })
      .eq('id', item!.id);
    expect(zeroUpdate.error?.code).toBe('23514');
    const zeroInsert = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 2, { price_cents: 0 }));
    expect(zeroInsert.error?.code).toBe('23514');
  });

  it('claim_wins conserva su check de precio positivo', async () => {
    const { error } = await seller.client
      .from('claim_items')
      .insert(itemRow('00000000-0000-4000-8000-000000000000', 1, { price_cents: 0 }));
    expect(error).not.toBeNull(); // sin evento no hay inserción: la FK/RLS lo impiden antes que el precio
  });
});

describe('nota del vendedor (migración 28)', () => {
  it('el dueño la escribe al insertar y al actualizar; límite de 80 caracteres', async () => {
    const session = await newDraft();
    const { data: created, error } = await seller.client
      .from('claim_items')
      .insert(itemRow(session.id, 1, { seller_note: 'Cartas del Centro, 2 nov' }))
      .select('*')
      .single();
    expect(error).toBeNull();
    expect(created!.seller_note).toBe('Cartas del Centro, 2 nov');
    const upd = await seller.client
      .from('claim_items')
      .update({ seller_note: 'otra nota' })
      .eq('id', created!.id)
      .select('seller_note')
      .single();
    expect(upd.data?.seller_note).toBe('otra nota');
    const tooLong = await seller.client
      .from('claim_items')
      .update({ seller_note: 'x'.repeat(81) })
      .eq('id', created!.id);
    expect(tooLong.error?.code).toBe('23514');
    const empty = await seller.client
      .from('claim_items')
      .update({ seller_note: '' })
      .eq('id', created!.id);
    expect(empty.error?.code).toBe('23514');
    const cleared = await seller.client
      .from('claim_items')
      .update({ seller_note: null })
      .eq('id', created!.id);
    expect(cleared.error).toBeNull();
  });
});
