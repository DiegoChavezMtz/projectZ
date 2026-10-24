import { describe, expect, it } from 'vitest';
import { assertCents, formatMXN } from '@/utils/money';

describe('formatMXN', () => {
  it('formatea centavos como pesos mexicanos', () => {
    expect(formatMXN(155000)).toBe('$1,550.00');
    expect(formatMXN(0)).toBe('$0.00');
    expect(formatMXN(5)).toBe('$0.05');
    expect(formatMXN(-2500)).toMatch(/^-\$25\.00$/);
  });

  it('rechaza valores que no son centavos enteros', () => {
    expect(() => formatMXN(10.5)).toThrow(RangeError);
    expect(() => assertCents(Number.NaN)).toThrow(RangeError);
  });
});
