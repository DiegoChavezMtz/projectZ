import { beforeAll, describe, expect, it, vi } from 'vitest';
import { anonClient } from '../helpers/supabase';
import {
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestSeller,
} from '../helpers/claims';

// S5-09: snapshot del visor contra la BD en línea, con el cliente de servidor sustituido por uno anónimo
// (así se ejercita RLS tal como la ve un visitante).
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => anonClient() }));

const { snapshotService } = await import('@/features/liveClaim/services/snapshot.service');

let seller: TestSeller;

beforeAll(async () => {
  seller = await createTestSeller();
});

async function codeOf(sessionId: string) {
  const { data } = await seller.client
    .from('claim_sessions')
    .select('code')
    .eq('id', sessionId)
    .single();
  return data!.code;
}

describe('snapshotService con RLS', () => {
  it('un anónimo ve el evento publicado, sus artículos visibles, el feed y la hora del servidor', async () => {
    const live = await createLiveSession(seller, { items: 3, releaseMode: 'manual' });
    await rpc(seller.client, 'release_item', { p_item_id: live.itemIds[0] });
    await rpc(seller.client, 'post_announcement', { p_session_id: live.sessionId, p_text: 'Hola' });

    const snapshot = await snapshotService.getSnapshot(await codeOf(live.sessionId));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.session.id).toBe(live.sessionId);
    expect(snapshot!.items.map((i) => i.id)).toEqual([live.itemIds[0]]); // los ocultos no se ven
    const types = snapshot!.feed.map((e) => e.type);
    expect(types).toContain('session_started');
    expect(types).toContain('announcement');
    const ids = snapshot!.feed.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(Math.abs(new Date(snapshot!.serverNow).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('el estado en vivo (líder) aparece en el snapshot', async () => {
    const [buyer] = await createTestBuyers(1);
    const live = await createLiveSession(seller, { autoConfirm: false });
    await rpc(buyer!.client, 'claim_item', { p_item_id: live.itemIds[0] });
    const snapshot = await snapshotService.getSnapshot(await codeOf(live.sessionId));
    expect(snapshot!.items[0]).toMatchObject({ leader_user_id: buyer!.user.id });
  });

  it('un borrador o un código inexistente devuelven null', async () => {
    const { data } = await seller.client
      .from('claim_sessions')
      .insert({
        seller_id: seller.user.id,
        title: 'Borrador',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('code')
      .single();
    expect(await snapshotService.getSnapshot(data!.code)).toBeNull();
    expect(await snapshotService.getSnapshot('ZZZZZZZZ')).toBeNull();
  });

  it('getServerClock devuelve un ISO cercano a la hora local', async () => {
    const iso = await snapshotService.getServerClock();
    expect(iso).toMatch(/Z$/);
    expect(Math.abs(new Date(iso).getTime() - Date.now())).toBeLessThan(60_000);
  });
});
