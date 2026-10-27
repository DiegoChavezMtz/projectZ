import { describe, expect, it } from 'vitest';
import {
  buildOperations,
  buildSummary,
  countHidden,
  memberSinceLabel,
  nextHiddenItem,
} from '@/features/claimEvents/utils/consoleOperations';
import { consoleEntry, item } from './consoleFactories';

const buyers = {
  l: { id: 'l', name: 'Luis', memberSince: '2026-01-01T00:00:00.000Z' },
  m: { id: 'm', name: 'María', memberSince: '2026-09-01T00:00:00.000Z' },
};

describe('buildOperations (S7-03)', () => {
  it('ordena la cola por seq, marca al líder y ordena ofertas por monto', () => {
    const [op] = buildOperations(
      [item({ id: 'item-1', leader_entry_id: 'e1' })],
      [
        consoleEntry({ id: 'e2', seq: 2, buyer_id: 'm' }),
        consoleEntry({ id: 'e1', seq: 1, buyer_id: 'l' }),
        consoleEntry({ id: 'o1', seq: 3, kind: 'offer', amount_cents: 9_000, status: 'pending' }),
        consoleEntry({ id: 'o2', seq: 4, kind: 'offer', amount_cents: 12_000, status: 'pending' }),
        consoleEntry({ id: 'x', seq: 5, status: 'rejected' }),
      ],
      buyers,
    );
    expect(op?.queue.map((r) => [r.entry.id, r.buyerName, r.isLeader])).toEqual([
      ['e1', 'Luis', true],
      ['e2', 'María', false],
    ]);
    expect(op?.offers.map((r) => r.entry.id)).toEqual(['o2', 'o1']);
    expect(op?.winner).toBeNull();
  });

  it('expone al ganador de un artículo vendido', () => {
    const [op] = buildOperations(
      [item({ id: 'item-1', status: 'sold' })],
      [consoleEntry({ id: 'w', status: 'accepted', buyer_id: 'l', amount_cents: 12_000 })],
      buyers,
    );
    expect(op?.winner?.buyerName).toBe('Luis');
  });
});

describe('liberación (S7-04)', () => {
  const items = [
    item({ id: 'c', position: 3, status: 'hidden' }),
    item({ id: 'a', position: 1, status: 'available' }),
    item({ id: 'b', position: 2, status: 'hidden' }),
  ];
  it('sugiere la siguiente oculta por posición y cuenta las pendientes', () => {
    expect(nextHiddenItem(items)?.id).toBe('b');
    expect(countHidden(items)).toBe(2);
    expect(nextHiddenItem([items[1]!])).toBeNull();
  });
});

describe('buildSummary (S7-07)', () => {
  it('sale de claim_wins: vendidos, ingresos y compradores', () => {
    const items = [
      item({ id: '1', status: 'sold' }),
      item({ id: '2', status: 'sold' }),
      item({ id: '3', status: 'available' }),
      item({ id: '4', status: 'withdrawn' }),
    ];
    const summary = buildSummary(
      items,
      [
        { id: 'w1', item_id: '1', buyer_id: 'l', price_cents: 10_000, won_via: 'claim' },
        { id: 'w2', item_id: '2', buyer_id: 'l', price_cents: 5_000, won_via: 'offer' },
      ],
      buyers,
    );
    expect(summary).toMatchObject({
      soldCount: 2,
      unsoldCount: 1,
      withdrawnCount: 1,
      revenueCents: 15_000,
    });
    expect(summary.buyers).toEqual([
      { buyerId: 'l', name: 'Luis', winsCount: 2, totalCents: 15_000 },
    ]);
  });
});

describe('memberSinceLabel', () => {
  const now = Date.parse('2026-10-26T00:00:00.000Z');
  it.each([
    ['2026-10-25T12:00:00.000Z', 'Cuenta nueva'],
    ['2026-10-16T00:00:00.000Z', '10 días'],
    ['2026-08-01T00:00:00.000Z', '2 meses'],
    ['2024-01-01T00:00:00.000Z', '2 años'],
  ])('%s → %s', (iso, label) => expect(memberSinceLabel(iso, now)).toBe(label));
  it('vacío sin fecha', () => expect(memberSinceLabel(null, now)).toBe(''));
});
