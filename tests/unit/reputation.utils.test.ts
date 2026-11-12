import { describe, expect, it } from 'vitest';
import {
  averageRating,
  closedOnTimeRate,
  deliveryOnTimeRate,
  formatDuration,
  formatHistoryEntry,
  formatMemberSince,
  formatPercent,
  formatRating,
  groupTags,
  isNewUser,
  paidOnTimeRate,
  ratingDistribution,
  tagsForRater,
  toBadgeData,
} from '@/features/reputation/utils/reputation.utils';
import type { HistoryEntry, ReputationStats } from '@/features/reputation/types';

const EMPTY: ReputationStats = {
  winsCount: 0,
  sessionsParticipated: 0,
  ordersPaidOnTime: 0,
  ordersPaidLate: 0,
  ordersUnpaid: 0,
  ordersReleased: 0,
  deliveriesReceived: 0,
  sessionsHosted: 0,
  winsSold: 0,
  ordersClosedOnTime: 0,
  ordersClosedLate: 0,
  deliveriesOnTime: 0,
  deliveriesLate: 0,
  ratingAsBuyerSum: 0,
  ratingAsBuyerCount: 0,
  ratingAsSellerSum: 0,
  ratingAsSellerCount: 0,
};

const entry = (patch: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'e1',
  role: 'buyer',
  kind: 'paid_on_time',
  status: 'active',
  sessionCode: 'ABC123',
  sessionTitle: 'Claim de viernes',
  counterpartyHandle: 'cartas',
  counterpartyName: 'Cartas del Centro',
  hours: null,
  method: null,
  stars: null,
  tags: [],
  comment: null,
  releaseReason: null,
  disputeNote: null,
  disputeResolutionNote: null,
  occurredAt: '2026-10-27T12:00:00Z',
  ...patch,
});

describe('tasas con mínimo de 3 casos', () => {
  it('0 casos y 2 casos no muestran porcentaje', () => {
    expect(paidOnTimeRate(EMPTY)).toBeNull();
    expect(paidOnTimeRate({ ordersPaidOnTime: 2, ordersPaidLate: 0, ordersUnpaid: 0 })).toBeNull();
    expect(deliveryOnTimeRate({ deliveriesOnTime: 1, deliveriesLate: 1 })).toBeNull();
    expect(closedOnTimeRate({ ordersClosedOnTime: 2, ordersClosedLate: 0 })).toBeNull();
  });

  it('con 3 casos ya se calcula', () => {
    expect(paidOnTimeRate({ ordersPaidOnTime: 3, ordersPaidLate: 0, ordersUnpaid: 0 })).toBe(1);
    expect(paidOnTimeRate({ ordersPaidOnTime: 2, ordersPaidLate: 1, ordersUnpaid: 1 })).toBe(0.5);
    expect(deliveryOnTimeRate({ deliveriesOnTime: 2, deliveriesLate: 1 })).toBeCloseTo(2 / 3);
  });

  it('solo impagos es 0 %', () => {
    expect(paidOnTimeRate({ ordersPaidOnTime: 0, ordersPaidLate: 0, ordersUnpaid: 3 })).toBe(0);
  });

  it('los guardaditos liberados no cuentan como impago', () => {
    const stats = { ...EMPTY, ordersPaidOnTime: 3, ordersReleased: 5 };
    expect(paidOnTimeRate(stats)).toBe(1);
  });

  it('formatPercent redondea', () => {
    expect(formatPercent(2 / 3)).toBe(67);
    expect(formatPercent(1)).toBe(100);
  });
});

describe('calificación promedio', () => {
  it('sin calificaciones es null', () => {
    expect(averageRating(0, 0)).toBeNull();
  });
  it('promedia y formatea a un decimal', () => {
    expect(averageRating(14, 3)).toBeCloseTo(4.667);
    expect(formatRating(14 / 3)).toBe('4.7');
    expect(formatRating(5)).toBe('5.0');
  });
});

describe('formatMemberSince', () => {
  it('usa mes y año en español', () => {
    expect(formatMemberSince('2026-10-15T12:00:00Z')).toBe('Miembro desde octubre de 2026');
  });
  it('respeta la zona de México en el cambio de mes', () => {
    // 1 de noviembre 03:00 UTC sigue siendo 31 de octubre en CDMX.
    expect(formatMemberSince('2026-11-01T03:00:00Z')).toBe('Miembro desde octubre de 2026');
  });
});

describe('formatDuration', () => {
  it('menos de una hora', () => expect(formatDuration(0.4)).toBe('menos de 1 h'));
  it('horas con un decimal', () => {
    expect(formatDuration(3.5)).toBe('3.5 h');
    expect(formatDuration(30)).toBe('30 h');
  });
  it('días a partir de 48 h', () => {
    expect(formatDuration(48)).toBe('2 días');
    expect(formatDuration(100)).toBe('4 días');
  });
});

describe('formatHistoryEntry', () => {
  it('pagó en N horas', () => {
    const line = formatHistoryEntry(entry({ hours: 3 }));
    expect(line).toMatchObject({ title: 'Pagó en 3 h', tone: 'positive', disputed: false });
  });
  it('pagó tarde es negativo', () => {
    expect(formatHistoryEntry(entry({ kind: 'paid_late', hours: 60 }))).toMatchObject({
      title: 'Pagó tarde, en 2 días',
      tone: 'negative',
    });
  });
  it('impago disputado conserva el texto y marca la disputa', () => {
    const line = formatHistoryEntry(entry({ kind: 'unpaid', status: 'disputed' }));
    expect(line).toMatchObject({ title: 'No pagó', tone: 'negative', disputed: true });
  });
  it('envío a tiempo y en persona', () => {
    expect(
      formatHistoryEntry(entry({ role: 'seller', kind: 'delivered_on_time', hours: 50 })).title,
    ).toBe('Envió en 2 días');
    expect(
      formatHistoryEntry(
        entry({ role: 'seller', kind: 'delivered_on_time', hours: 5, method: 'pickup' }),
      ).title,
    ).toBe('Entregó en persona en 5 h');
    expect(formatHistoryEntry(entry({ kind: 'delivered_late', hours: 100 })).title).toBe(
      'Envío tardío (4 días)',
    );
  });
  it('guardadito liberado es neutro, no advertencia', () => {
    const line = formatHistoryEntry(
      entry({ kind: 'accumulate_released', releaseReason: 'buyer_request' }),
    );
    expect(line.tone).toBe('neutral');
    expect(line.title).toBe('Guardadito liberado: a petición del comprador');
    expect(formatHistoryEntry(entry({ kind: 'accumulate_released' })).title).toBe(
      'Guardadito liberado',
    );
  });
  it('calificación con estrellas y etiquetas', () => {
    const line = formatHistoryEntry(
      entry({ kind: 'rated', stars: 5, tags: ['envio_rapido', 'amable'] }),
    );
    expect(line.title).toBe('Recibió 5 estrellas');
    expect(line.tagLabels).toEqual(['Envío rápido', 'Amable']);
    expect(formatHistoryEntry(entry({ kind: 'rated', stars: 1 })).title).toBe('Recibió 1 estrella');
    expect(formatHistoryEntry(entry({ kind: 'rated', stars: 1 })).tone).toBe('negative');
  });
  it('sin horas usa un texto genérico', () => {
    expect(formatHistoryEntry(entry({ hours: null })).title).toBe('Pagó a tiempo');
  });
});

describe('etiquetas y distribución', () => {
  it('etiquetas permitidas por rol', () => {
    expect(tagsForRater('buyer')).toContain('empaque_cuidadoso');
    expect(tagsForRater('buyer')).not.toContain('pago_rapido');
    expect(tagsForRater('seller')).toEqual(['pago_rapido', 'buena_comunicacion', 'amable']);
  });
  it('groupTags suma, ordena por frecuencia y limita', () => {
    const rows = [
      { tag: 'amable' as const, total: 1 },
      { tag: 'pago_rapido' as const, total: 4 },
      { tag: 'amable' as const, total: 2 },
      { tag: 'buena_comunicacion' as const, total: 3 },
    ];
    expect(groupTags(rows).map((r) => [r.tag, r.total])).toEqual([
      ['pago_rapido', 4],
      ['amable', 3],
      ['buena_comunicacion', 3],
    ]);
    expect(groupTags(rows, 1)).toHaveLength(1);
    expect(groupTags([])).toEqual([]);
  });
  it('distribución completa con ceros', () => {
    const dist = ratingDistribution([
      { stars: 5, total: 3 },
      { stars: 1, total: 1 },
    ]);
    expect(dist.map((d) => d.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(dist[0]).toMatchObject({ total: 3, share: 0.75 });
    expect(dist[1]).toMatchObject({ total: 0, share: 0 });
    expect(ratingDistribution([]).every((d) => d.share === 0)).toBe(true);
  });
});

describe('isNewUser y toBadgeData', () => {
  it('sin ningún contador es nuevo', () => {
    expect(isNewUser(EMPTY)).toBe(true);
    expect(isNewUser({ ...EMPTY, sessionsParticipated: 1 })).toBe(false);
  });
  it('comprador: claims ganados y tasa de pago', () => {
    const data = toBadgeData(
      { userId: 'u', handle: 'luis', memberSince: '2026-10-01T00:00:00Z', isSeller: false },
      { ...EMPTY, winsCount: 7, ordersPaidOnTime: 3, ratingAsBuyerSum: 9, ratingAsBuyerCount: 2 },
    );
    expect(data).toMatchObject({ winsCount: 7, paidOnTimeRate: 1, isNew: false });
    expect(data.rating).toEqual({ average: 4.5, count: 2 });
  });
  it('vendedor: claims entregados y sin tasa de pago', () => {
    const data = toBadgeData(
      { userId: 'u', handle: 'cartas', memberSince: '2026-10-01T00:00:00Z', isSeller: true },
      { ...EMPTY, winsSold: 12, winsCount: 1, ratingAsSellerSum: 5, ratingAsSellerCount: 1 },
    );
    expect(data).toMatchObject({ winsCount: 12, paidOnTimeRate: null });
    expect(data.rating).toEqual({ average: 5, count: 1 });
  });
});
