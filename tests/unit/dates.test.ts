import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from '@/utils/dates';

describe('fechas en America/Mexico_City', () => {
  it('convierte UTC a hora de la Ciudad de México (UTC-6)', () => {
    // 2026-03-16T00:30:00Z = 15 de marzo, 6:30 p.m. en CDMX
    expect(formatDate('2026-03-16T00:30:00Z')).toBe('15 de marzo de 2026');
    expect(formatTime('2026-03-16T00:30:00Z')).toMatch(/^6:30\s?p\.\s?m\.$/);
    expect(formatDateTime('2026-03-16T00:30:00Z')).toMatch(
      /^15 de marzo de 2026(,| a las) 6:30\s?p\.\s?m\.$/,
    );
  });

  it('acepta Date y no depende de la zona del sistema', () => {
    expect(formatDate(new Date('2026-07-01T05:59:59Z'))).toBe('30 de junio de 2026');
    expect(formatDate(new Date('2026-07-01T06:00:00Z'))).toBe('1 de julio de 2026');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => formatDate('no-es-fecha')).toThrow(RangeError);
  });
});
