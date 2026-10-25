import { describe, expect, it } from 'vitest';
import { isoToMexicoLocal, mexicoLocalToIso } from '@/utils/dates';
import { fitWithin } from '@/utils/image';
import { centsToPesosInput, parsePesosToCents } from '@/utils/money';

describe('parsePesosToCents', () => {
  it.each([
    ['$1,550.50', 155050],
    ['1550.5', 155050],
    ['1550', 155000],
    ['0.07', 7],
    ['$ 12', 1200],
    ['1,000,000.99', 100000099],
    ['19.99', 1999],
    ['1.15', 115],
  ])('%s → %i', (input, cents) => expect(parsePesosToCents(input)).toBe(cents));

  it.each(['', 'abc', '1.234', '-5', '1,55', '12.', '.5', '1 000'])('rechaza %j', (input) =>
    expect(parsePesosToCents(input)).toBeNull(),
  );

  it('centsToPesosInput es inverso', () => {
    expect(centsToPesosInput(155050)).toBe('1550.50');
    expect(centsToPesosInput(7)).toBe('0.07');
    expect(parsePesosToCents(centsToPesosInput(155050))).toBe(155050);
  });
});

describe('fechas America/Mexico_City', () => {
  it('convierte local ↔ ISO (UTC−6 sin horario de verano desde 2022)', () => {
    expect(mexicoLocalToIso('2026-03-15T18:30')).toBe('2026-03-16T00:30:00.000Z');
    expect(isoToMexicoLocal('2026-03-16T00:30:00.000Z')).toBe('2026-03-15T18:30');
  });
  it('ida y vuelta estable', () => {
    const iso = mexicoLocalToIso('2026-11-02T09:05');
    expect(iso && isoToMexicoLocal(iso)).toBe('2026-11-02T09:05');
  });
  it('rechaza formato o fechas inexistentes', () => {
    expect(mexicoLocalToIso('mañana')).toBeNull();
    expect(mexicoLocalToIso('2026-02-31T10:00')).toBeNull();
  });
});

describe('fitWithin', () => {
  it('reduce por el lado mayor conservando proporción', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });
  it('no agranda', () => expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 }));
  it('lanza con dimensiones inválidas', () => expect(() => fitWithin(0, 5, 10)).toThrow());
});
