import { describe, expect, it } from 'vitest';
import {
  applyKeypadKey,
  formatKeypadDisplay,
  keypadToCents,
  type KeypadKey,
} from '@/features/claimEvents/utils/scanner/price';

const type = (keys: KeypadKey[]) => keys.reduce((value, key) => applyKeypadKey(value, key), '');

describe('teclado de precio', () => {
  it('$1,550.50 guarda 155050 centavos', () => {
    const value = type(['1', '5', '5', '0', 'dot', '5', '0']);
    expect(value).toBe('1550.50');
    expect(keypadToCents(value)).toBe(155050);
    expect(formatKeypadDisplay(value)).toBe('$1,550.50');
  });
  it('un decimal: 1550.5 son 155050', () => {
    expect(keypadToCents(type(['1', '5', '5', '0', 'dot', '5']))).toBe(155050);
  });
  it('enteros y punto final', () => {
    expect(keypadToCents('180')).toBe(18000);
    expect(keypadToCents('180.')).toBe(18000);
  });
  it('sin precio: vacío, cero o solo punto', () => {
    expect(keypadToCents('')).toBeNull();
    expect(keypadToCents('0')).toBeNull();
    expect(keypadToCents('0.00')).toBeNull();
    expect(keypadToCents('.')).toBeNull();
  });
  it('punto al inicio, un solo punto y máximo dos decimales', () => {
    expect(type(['dot'])).toBe('0.');
    expect(type(['1', 'dot', 'dot', '2'])).toBe('1.2');
    expect(type(['1', 'dot', '2', '3', '4'])).toBe('1.23');
  });
  it('sin ceros a la izquierda', () => {
    expect(type(['0', '0', '5'])).toBe('5');
    expect(type(['0', '0'])).toBe('0');
  });
  it('limita los dígitos enteros', () => {
    expect(type(Array(12).fill('9') as KeypadKey[])).toBe('9999999');
  });
  it('borrar y limpiar', () => {
    expect(type(['1', '2', '3', 'back'])).toBe('12');
    expect(type(['1', '2', 'clear'])).toBe('');
    expect(applyKeypadKey('', 'back')).toBe('');
  });
  it('muestra $0 vacío y separa miles al teclear', () => {
    expect(formatKeypadDisplay('')).toBe('$0');
    expect(formatKeypadDisplay('1234567')).toBe('$1,234,567');
    expect(formatKeypadDisplay('0.')).toBe('$0.');
  });
});
