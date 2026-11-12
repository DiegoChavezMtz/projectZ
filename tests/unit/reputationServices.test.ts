import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reputationBadgeService, statsFromRow } from '@/services/reputation.service';
import { toHistoryEntry } from '@/features/reputation/services/reputation.service';
import type { Database } from '@/types/database.types';

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));

type Row = Database['public']['Views']['public_user_stats']['Row'];
type EventRow = Database['public']['Views']['public_reputation_events']['Row'];

const row = (patch: Partial<Row>): Row =>
  ({
    user_id: 'u1',
    handle: 'luis',
    display_name: 'Luis',
    member_since: '2026-10-01T00:00:00Z',
    is_seller: false,
    wins_count: 4,
    orders_paid_on_time: 3,
    rating_as_buyer_sum: 10,
    rating_as_buyer_count: 2,
    ...patch,
  }) as Row;

function fakeClient(rows: Row[]) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient<Database>, from, inFn };
}

describe('reputationBadgeService.forUsers', () => {
  it('trae varios usuarios en UNA sola consulta (sin N+1)', async () => {
    const { client, from, inFn } = fakeClient([
      row({ user_id: 'u1' }),
      row({ user_id: 'u2', handle: 'ana' }),
    ]);
    const map = await reputationBadgeService.forUsers(client, ['u1', 'u2', 'u1', 'u2']);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('public_user_stats');
    expect(inFn).toHaveBeenCalledWith('user_id', ['u1', 'u2']);
    expect([...map.keys()]).toEqual(['u1', 'u2']);
  });

  it('sin ids no consulta', async () => {
    const { client, from } = fakeClient([]);
    expect((await reputationBadgeService.forUsers(client, [])).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('calcula promedio y tasa de pago; asRole fuerza el rol mostrado', async () => {
    const { client } = fakeClient([row({})]);
    const asBuyer = await reputationBadgeService.forUsers(client, ['u1']);
    expect(asBuyer.get('u1')).toMatchObject({
      winsCount: 4,
      paidOnTimeRate: 1,
      rating: { average: 5, count: 2 },
      isSeller: false,
    });
    const asSeller = await reputationBadgeService.forUsers(client, ['u1'], { asRole: 'seller' });
    expect(asSeller.get('u1')).toMatchObject({ isSeller: true, paidOnTimeRate: null });
  });

  it('ignora filas incompletas', async () => {
    const { client } = fakeClient([row({ handle: null })]);
    expect((await reputationBadgeService.forUsers(client, ['u1'])).size).toBe(0);
  });
});

describe('statsFromRow', () => {
  it('convierte nulos de la vista en ceros', () => {
    expect(statsFromRow({} as Row).winsCount).toBe(0);
    expect(statsFromRow(row({})).ordersPaidOnTime).toBe(3);
  });
});

describe('toHistoryEntry', () => {
  const base: EventRow = {
    id: 'e1',
    user_id: 'u1',
    role: 'buyer',
    kind: 'paid_on_time',
    status: 'active',
    session_id: 's1',
    session_code: 'ABC',
    session_title: 'Claim',
    order_id: 'o1',
    counterparty_id: 'u2',
    counterparty_handle: 'tienda',
    counterparty_name: 'Tienda',
    payload: { hours: 3.5 },
    occurred_at: '2026-10-27T10:00:00Z',
    dispute_note: null,
    dispute_resolution_note: null,
  };

  it('lee horas, método, estrellas y etiquetas del payload', () => {
    expect(toHistoryEntry(base)?.hours).toBe(3.5);
    const rated = toHistoryEntry({
      ...base,
      kind: 'rated',
      payload: { stars: 4, tags: ['amable', 'inventada'], comment: 'Muy bien' },
    });
    expect(rated).toMatchObject({ stars: 4, tags: ['amable'], comment: 'Muy bien' });
    expect(
      toHistoryEntry({ ...base, kind: 'delivered_on_time', payload: { method: 'pickup' } })?.method,
    ).toBe('pickup');
  });

  it('las marcas revocadas y las filas incompletas no llegan a la UI', () => {
    expect(toHistoryEntry({ ...base, status: 'revoked' })).toBeNull();
    expect(toHistoryEntry({ ...base, id: null })).toBeNull();
  });

  it('una marca en disputa conserva la nota', () => {
    expect(
      toHistoryEntry({ ...base, kind: 'unpaid', status: 'disputed', dispute_note: 'Pagué' }),
    ).toMatchObject({ status: 'disputed', disputeNote: 'Pagué' });
  });
});
