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
