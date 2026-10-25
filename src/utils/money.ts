// Dinero: enteros en centavos MXN. Nunca floats. El formateo vive solo aquí.
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Se esperaban centavos enteros, se recibió ${value}`);
  }
  return value;
}

/** 155000 → "$1,550.00" */
export function formatMXN(cents: number): string {
  return mxn.format(assertCents(cents) / 100);
}

/**
 * "$1,550.50" → 155050. Sin floats: se opera sobre la cadena para evitar errores de redondeo
 * (1550.5 * 100 no es seguro en binario). Devuelve null si no es un monto válido en pesos
 * (admite símbolo, comas de miles y hasta 2 decimales).
 */
export function parsePesosToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/\s*(MXN|mxn)$/, '');
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const pesos = Number((match[1] ?? '').replaceAll(',', ''));
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const total = pesos * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/** 155050 → "1550.50" (para rellenar un campo de edición, sin símbolo ni separadores). */
export function centsToPesosInput(cents: number): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
