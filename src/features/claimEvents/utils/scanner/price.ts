import { parsePesosToCents } from '@/utils/money';

export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'dot' | 'back' | 'clear';

export const KEYPAD_MAX_INTEGER_DIGITS = 7; // $9,999,999.99 cabe en int4 con margen
export const KEYPAD_MAX_DECIMALS = 2;

/** Aplica una tecla del teclado numérico al texto del precio (pesos, sin símbolo ni comas). */
export function applyKeypadKey(value: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return value.slice(0, -1);
  if (key === 'dot') {
    if (value.includes('.')) return value;
    return value === '' ? '0.' : `${value}.`;
  }
  const [integer = '', decimals] = value.split('.');
  if (decimals !== undefined)
    return decimals.length >= KEYPAD_MAX_DECIMALS ? value : `${value}${key}`;
  if (integer === '0') return key === '0' ? value : key;
  return integer.length >= KEYPAD_MAX_INTEGER_DIGITS ? value : `${integer}${key}`;
}

/** Texto del teclado → centavos enteros. Vacío o cero equivale a "sin precio" (null). */
export function keypadToCents(value: string): number | null {
  const trimmed = value.endsWith('.') ? value.slice(0, -1) : value;
  if (trimmed === '') return null;
  const cents = parsePesosToCents(trimmed);
  return cents === null || cents <= 0 ? null : cents;
}

/** "1550.5" → "$1,550.5": lo que se muestra mientras se teclea (no redondea ni agrega ceros). */
export function formatKeypadDisplay(value: string): string {
  if (value === '') return '$0';
  const [integer = '0', decimals] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${grouped}${decimals !== undefined ? `.${decimals}` : ''}`;
}
