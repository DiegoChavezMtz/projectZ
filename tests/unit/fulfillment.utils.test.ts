import { describe, expect, it } from 'vitest';
import {
  canRequestDelivery,
  groupAccumulableOrders,
  isAccumulateExpired,
} from '@/features/fulfillment/utils/accumulate';
import { deadlineStatus, formatRemaining } from '@/features/fulfillment/utils/deadlines';
import { fulfillmentErrorMessage } from '@/features/fulfillment/services/errors';
import type { OrderTiming } from '@/features/fulfillment/types';

const NOW = new Date('2026-11-10T12:00:00Z');
const H = 3_600_000;

const order = (patch: Partial<OrderTiming> = {}): OrderTiming => ({
  status: 'paid',
  accumulate: true,
  deliveryId: null,
  sellerId: 's1',
  payDueAt: null,
  paidAt: '2026-10-01T00:00:00Z',
  accumulateUntil: '2026-12-01T00:00:00Z',
  accumulateGraceUntil: null,
  releasedAt: null,
  ...patch,
});

describe('deadlineStatus', () => {
  it('sin fecha no hay plazo', () => {
    expect(deadlineStatus(null, NOW)).toEqual({ state: 'none', remainingMs: 0 });
    expect(deadlineStatus('basura', NOW).state).toBe('none');
  });

  it('distingue ok, soon (< 12 h) y overdue', () => {
    expect(deadlineStatus(new Date(NOW.getTime() + 48 * H).toISOString(), NOW).state).toBe('ok');
    expect(deadlineStatus(new Date(NOW.getTime() + 11 * H).toISOString(), NOW).state).toBe('soon');
    expect(deadlineStatus(NOW.toISOString(), NOW).state).toBe('overdue');
    expect(deadlineStatus(new Date(NOW.getTime() - H).toISOString(), NOW).remainingMs).toBe(-H);
  });
});

describe('formatRemaining', () => {
  it.each([
    [-1, 'Vencido'],
    [0, 'Vencido'],
    [30_000, 'Menos de 1 min'],
    [90_000, '1 min'],
    [3 * H + 20 * 60_000, '3 h 20 min'],
    [5 * H, '5 h'],
    [2 * 24 * H + 5 * H, '2 d 5 h'],
    [3 * 24 * H, '3 d'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});

describe('canRequestDelivery', () => {
  it('acepta una cuenta acumulada, pagada y libre', () => {
    expect(canRequestDelivery(order(), NOW)).toBe(true);
  });

  it('rechaza cuentas que no son del guardadito, ya tienen entrega o están liberadas', () => {
    expect(canRequestDelivery(order({ accumulate: false }), NOW)).toBe(false);
    expect(canRequestDelivery(order({ status: 'awaiting_payment' }), NOW)).toBe(false);
    expect(canRequestDelivery(order({ deliveryId: 'd1' }), NOW)).toBe(false);
    expect(
      canRequestDelivery(order({ status: 'released', releasedAt: NOW.toISOString() }), NOW),
    ).toBe(false);
  });

  it('vencida: solo dentro del plazo de gracia', () => {
    const grace = new Date(NOW.getTime() + 24 * H).toISOString();
    expect(canRequestDelivery(order({ accumulateGraceUntil: grace }), NOW)).toBe(true);
    expect(canRequestDelivery(order({ accumulateGraceUntil: NOW.toISOString() }), NOW)).toBe(false);
  });
});

describe('isAccumulateExpired', () => {
  it('compara con la vigencia', () => {
    expect(isAccumulateExpired(order({ accumulateUntil: '2026-11-01T00:00:00Z' }), NOW)).toBe(true);
    expect(isAccumulateExpired(order(), NOW)).toBe(false);
    expect(isAccumulateExpired(order({ accumulate: false }), NOW)).toBe(false);
  });
});

describe('groupAccumulableOrders', () => {
  it('agrupa por vendedor, ordena por vigencia y omite lo no elegible', () => {
    const a = order({ sellerId: 's1', accumulateUntil: '2026-12-20T00:00:00Z' });
    const b = order({ sellerId: 's2' });
    const c = order({ sellerId: 's1', accumulateUntil: '2026-12-05T00:00:00Z' });
    const skipped = order({ sellerId: 's1', deliveryId: 'd1' });
    const groups = groupAccumulableOrders([a, b, c, skipped], NOW);
    expect(groups.map((g) => g.sellerId)).toEqual(['s1', 's2']);
    expect(groups[0]!.orders).toEqual([c, a]);
  });
});

describe('fulfillmentErrorMessage', () => {
  it('traduce códigos conocidos y cae en unknown', () => {
    expect(fulfillmentErrorMessage('address_required')).toMatch(/dirección/);
    expect(fulfillmentErrorMessage('nada')).toBe('Algo salió mal. Intenta de nuevo.');
    expect(fulfillmentErrorMessage(undefined)).toBe('Algo salió mal. Intenta de nuevo.');
  });
});
