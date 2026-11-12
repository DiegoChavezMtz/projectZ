// Fechas: ISO UTC en transporte; presentación siempre en America/Mexico_City.
export const APP_TIME_ZONE = 'America/Mexico_City';

type DateInput = string | Date;

const toDate = (value: DateInput): Date => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha inválida: ${String(value)}`);
  return date;
};

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "15 de marzo de 2026" */
export const formatDate = (value: DateInput) => dateFormat.format(toDate(value));
/** "6:30 p.m." */
export const formatTime = (value: DateInput) => timeFormat.format(toDate(value));
/** "15 de marzo de 2026, 6:30 p.m." */
export const formatDateTime = (value: DateInput) => dateTimeFormat.format(toDate(value));

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const zonedParts = (instant: Date) => {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

/** ISO UTC → "2026-03-15T18:30" en America/Mexico_City (valor de `<input type="datetime-local">`). */
export const isoToMexicoLocal = (iso: DateInput) => zonedParts(toDate(iso));

/**
 * "2026-03-15T18:30" interpretado en America/Mexico_City → ISO UTC. Null si el texto no es válido.
 * Resuelve el desfase con la propia zona (sin asumir un offset fijo).
 */
export function mexicoLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc)) return null;
  // Dos pasadas: el offset de la zona se evalúa en el instante candidato.
  let instant = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = zonedParts(new Date(instant));
    const [sy, smo, sd, sh, smi] = shown.split(/[-T:]/).map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    instant += asUtc - Date.UTC(sy, smo - 1, sd, sh, smi);
  }
  const result = new Date(instant);
  // Rechaza fechas inexistentes (31 de febrero) que Date.UTC normaliza.
  return zonedParts(result) === local ? result.toISOString() : null;
}

const monthYearFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});
/** "octubre de 2026" */
export const formatMonthYear = (value: DateInput) => monthYearFormat.format(toDate(value));
