import { describe, expect, it } from 'vitest';
import {
  clockOffset,
  clockOffsetFromSample,
  describeRemaining,
  formatRemaining,
  remainingMs,
  splitRemaining,
} from '@/features/liveClaim/utils/clock';

describe('reloj', () => {
  it('clockOffset: servidor − dispositivo', () => {
    expect(clockOffset(10_000, 4_000)).toBe(6_000);
    expect(clockOffset(4_000, 10_000)).toBe(-6_000);
  });

  it('clockOffsetFromSample compensa medio viaje de ida y vuelta', () => {
    // Dispositivo adelantado 5 s; el viaje tardó 200 ms.
    const offset = clockOffsetFromSample({ serverMs: 100_000, sentAtMs: 105_000, receivedAtMs: 105_200 });
    // Al recibir, el servidor marcaba ~100_100 y el dispositivo 105_200.
    expect(offset).toBe(-5_100);
  });

  it('remainingMs usa la hora del servidor y nunca es negativo', () => {
    const target = '2026-10-27T00:00:10.000Z';
    const now = Date.parse('2026-10-27T00:00:00.000Z');
    expect(remainingMs(target, now, 0)).toBe(10_000);
    expect(remainingMs(target, now, 4_000)).toBe(6_000); // el servidor va 4 s adelante
    expect(remainingMs(target, now, 60_000)).toBe(0);
  });

  it('splitRemaining y formatRemaining', () => {
    expect(splitRemaining(2 * 86_400_000 + 3 * 3_600_000 + 15 * 60_000 + 9_000)).toEqual({
      days: 2,
      hours: 3,
      minutes: 15,
      seconds: 9,
    });
    expect(formatRemaining(2 * 86_400_000 + 3 * 3_600_000 + 15 * 60_000 + 9_000)).toBe('2 d 03:15:09');
    expect(formatRemaining(3 * 3_600_000 + 5_000)).toBe('03:00:05');
    expect(formatRemaining(15 * 60_000 + 9_000)).toBe('15:09');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(-5)).toBe('00:00');
  });

  it('describeRemaining para lectores de pantalla', () => {
    expect(describeRemaining(2 * 86_400_000 + 3 * 3_600_000 + 15 * 60_000)).toBe('2 días, 3 horas y 15 minutos');
    expect(describeRemaining(60_000)).toBe('1 minuto');
    expect(describeRemaining(30_000)).toBe('0 minutos');
  });
});
