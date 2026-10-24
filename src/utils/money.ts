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
