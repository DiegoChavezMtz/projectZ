import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient } from '../helpers/supabase';
import {
  auditSession,
  auditUserStats,
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type RpcResult,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';

// S5-06: pruebas de concurrencia del motor contra la BD en línea. NO son pruebas de carga: volúmenes
// moderados (50 compradores), usuarios is_test creados aquí y limpiados por tests/db/setup.ts (afterAll).
//
// Cada comprador necesita sesión: Auth limita las verificaciones de token (30 / 5 min por IP por defecto);
// createTestBuyers espera y reintenta. Para correr rápido, sube temporalmente ese límite (supabase-setup.md).

const BUYERS = Number(process.env.CONCURRENCY_BUYERS ?? 50);

let seller: TestSeller;
let buyers: TestBuyer[];

beforeAll(async () => {
  seller = await createTestSeller();
  buyers = await createTestBuyers(BUYERS);
}, 900_000);

const admin = () => adminClient();

async function entriesOf(itemId: string) {
  const { data } = await admin()
    .from('claim_entries')
    .select('id, buyer_id, kind, status, seq')
    .eq('item_id', itemId)
    .order('seq');
  return data ?? [];
}

const codes = (results: RpcResult[]) => {
  const tally: Record<string, number> = {};
  for (const r of results) {
    const key = r.ok ? 'ok' : (r.code ?? 'error');
    tally[key] = (tally[key] ?? 0) + 1;
  }
  return tally;
};

/** Invariantes comunes tras cada escenario. */
async function expectInvariants(sessionId: string, itemIds: string[]) {
  expect(await auditSession(sessionId)).toEqual([]);
  for (const itemId of itemIds) {
    const entries = await entriesOf(itemId);
    expect(entries.filter((e) => e.status === 'accepted').length).toBeLessThanOrEqual(1);
    const seqs = entries.map((e) => Number(e.seq));
    expect(seqs.every((s, i) => i === 0 || s > seqs[i - 1]!)).toBe(true);
    const { data: wins } = await admin().from('claim_wins').select('id').eq('item_id', itemId);
    const { data: item } = await admin()
      .from('claim_items')
      .select('status')
      .eq('id', itemId)
      .single();
    expect(wins).toHaveLength(item?.status === 'sold' ? 1 : 0);
  }
  for (const buyer of buyers) expect(await auditUserStats(buyer.user.id)).toEqual([]);
  expect(await auditUserStats(seller.user.id)).toEqual([]);
}

describe('concurrencia del motor', () => {
  it('N claim_item sobre el mismo artículo con auto_confirm: un ganador, el resto item_not_available', async () => {
    const live = await createLiveSession(seller, { autoConfirm: true });
    const itemId = live.itemIds[0]!;
    const results = await Promise.all(
      buyers.map((b) => rpc(b.client, 'claim_item', { p_item_id: itemId })),
    );
    expect(codes(results)).toEqual({ ok: 1, item_not_available: buyers.length - 1 });
    expect(results.filter((r) => r.won)).toHaveLength(1);

    const entries = await entriesOf(itemId);
    expect(entries.map((e) => e.status)).toEqual(['accepted']);
    const { data: wins } = await admin()
      .from('claim_wins')
      .select('buyer_id')
      .eq('item_id', itemId);
    expect(wins).toHaveLength(1);
    await expectInvariants(live.sessionId, [itemId]);
  });

  it('N claim_item sin auto_confirm: cola completa con seq creciente y un solo líder', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false });
    const itemId = live.itemIds[0]!;
    const results = await Promise.all(
      buyers.map((b) => rpc(b.client, 'claim_item', { p_item_id: itemId })),
    );
    expect(codes(results)).toEqual({ ok: buyers.length });
    expect(results.map((r) => r.position).sort((a, b) => Number(a) - Number(b))).toEqual(
      buyers.map((_, i) => i + 1),
    );
    const entries = await entriesOf(itemId);
    expect(entries).toHaveLength(buyers.length);
    const { data: item } = await admin()
      .from('claim_items')
      .select('leader_entry_id')
      .eq('id', itemId)
      .single();
    expect(item?.leader_entry_id).toBe(entries[0]!.id);
    await expectInvariants(live.sessionId, [itemId]);
  });

  it('claims y ofertas simultáneos: sin doble adjudicación y offer_count correcto', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, priceCents: 10_000 });
    const itemId = live.itemIds[0]!;
    const half = Math.floor(buyers.length / 2);
    const claimers = buyers.slice(0, half);
    const offerers = buyers.slice(half);
    const results = await Promise.all([
      ...claimers.map((b) => rpc(b.client, 'claim_item', { p_item_id: itemId })),
      ...offerers.map((b) =>
        rpc(b.client, 'make_offer', { p_item_id: itemId, p_amount_cents: 5_000 }),
      ),
    ]);
    expect(codes(results)).toEqual({ ok: buyers.length });

    const { data: item } = await admin()
      .from('claim_items')
      .select('offer_count, status')
      .eq('id', itemId)
      .single();
    expect(item).toEqual({ offer_count: offerers.length, status: 'available' });

    // El vendedor acepta una oferta mientras otros compradores siguen entrando.
    const pending = (await entriesOf(itemId)).filter(
      (e) => e.kind === 'offer' && e.status === 'pending',
    );
    const [accept, ...extra] = await Promise.all([
      rpc(seller.client, 'accept_offer', { p_entry_id: pending[0]!.id }),
      ...claimers.slice(0, 5).map((b) =>
        rpc(b.client, 'withdraw_entry', {
          p_entry_id: results[claimers.indexOf(b)]!.entry_id as string,
        }),
      ),
    ]);
    expect(accept).toMatchObject({ ok: true });
    expect(extra.every((r) => r.ok || r.code === 'invalid_state')).toBe(true);

    const entries = await entriesOf(itemId);
    expect(entries.filter((e) => e.status === 'accepted')).toHaveLength(1);
    expect(entries.filter((e) => e.status === 'queued' || e.status === 'pending')).toHaveLength(0);
    await expectInvariants(live.sessionId, [itemId]);
  });

  it('confirm_entry vs reject_entry simultáneos sobre el mismo líder: exactamente una gana', async () => {
    for (let round = 0; round < 3; round++) {
      const live = await createLiveSession(seller, { autoConfirm: false });
      const itemId = live.itemIds[0]!;
      const first = await rpc(buyers[0]!.client, 'claim_item', { p_item_id: itemId });
      await rpc(buyers[1]!.client, 'claim_item', { p_item_id: itemId });

      const [confirm, reject] = await Promise.all([
        rpc(seller.client, 'confirm_entry', { p_entry_id: first.entry_id }),
        rpc(seller.client, 'reject_entry', { p_entry_id: first.entry_id }),
      ]);
      expect([confirm.ok, reject.ok].filter(Boolean)).toHaveLength(1);
      const loser = confirm.ok ? reject : confirm;
      expect(loser.code).toBe('invalid_state');

      const { data: item } = await admin()
        .from('claim_items')
        .select('status, leader_user_id')
        .eq('id', itemId)
        .single();
      if (confirm.ok) expect(item?.status).toBe('sold');
      else expect(item).toEqual({ status: 'available', leader_user_id: buyers[1]!.user.id });
      await expectInvariants(live.sessionId, [itemId]);
    }
  });

  it('start_session doble simultáneo: una sola inicia y sessions_hosted sube una vez', async () => {
    const before = (
      await admin()
        .from('user_stats')
        .select('sessions_hosted')
        .eq('user_id', seller.user.id)
        .single()
    ).data!.sessions_hosted;
    const live = await createLiveSession(seller, { live: false });
    const results = await Promise.all([
      rpc(seller.client, 'start_session', { p_session_id: live.sessionId }),
      rpc(seller.client, 'start_session', { p_session_id: live.sessionId }),
      rpc(seller.client, 'start_session', { p_session_id: live.sessionId }),
    ]);
    expect(codes(results)).toEqual({ ok: 1, invalid_state: 2 });
    const after = (
      await admin()
        .from('user_stats')
        .select('sessions_hosted')
        .eq('user_id', seller.user.id)
        .single()
    ).data!.sessions_hosted;
    expect(after).toBe(before + 1);
    await expectInvariants(live.sessionId, live.itemIds);
  });

  it('end_session simultáneo con claims: nada queda abierto en un evento terminado', async () => {
    const live = await createLiveSession(seller, { autoConfirm: false, items: 2 });
    const [i1, i2] = live.itemIds as [string, string];
    const results = await Promise.all([
      ...buyers
        .slice(0, 20)
        .map((b, i) => rpc(b.client, 'claim_item', { p_item_id: i % 2 ? i1 : i2 })),
      rpc(seller.client, 'end_session', { p_session_id: live.sessionId }),
    ]);
    expect(results.every((r) => r.ok || r.code === 'session_not_live')).toBe(true);
    const { data: open } = await admin()
      .from('claim_entries')
      .select('id')
      .eq('session_id', live.sessionId)
      .in('status', ['queued', 'pending']);
    expect(open).toEqual([]);
    await expectInvariants(live.sessionId, [i1, i2]);
  });
});
