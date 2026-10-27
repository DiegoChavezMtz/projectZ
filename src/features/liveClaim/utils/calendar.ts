const MINUTE = 60_000;
/** Duración por defecto cuando el evento no trae cierre ni duración esperada. */
export const DEFAULT_EVENT_MINUTES = 60;

export type CalendarEvent = {
  uid: string;
  title: string;
  description?: string | null;
  startsAt: string;
  /** Cierre del evento; si falta se usa `expectedDurationMinutes` y luego 60 minutos. */
  closesAt?: string | null;
  expectedDurationMinutes?: number | null;
  url: string;
};

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function eventEnd(event: CalendarEvent): Date {
  const start = new Date(event.startsAt);
  if (event.closesAt) return new Date(event.closesAt);
  return new Date(start.getTime() + (event.expectedDurationMinutes ?? DEFAULT_EVENT_MINUTES) * MINUTE);
}

const detailsText = (event: CalendarEvent) =>
  [event.description?.trim(), event.url].filter(Boolean).join('\n\n');

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(new Date(event.startsAt))}/${stamp(eventEnd(event))}`,
    details: detailsText(event),
    location: event.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa texto según RFC 5545 §3.3.11. */
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\;').replace(/,/g, '\\,');

/** Pliega líneas a 75 octetos (RFC 5545 §3.1) sin partir caracteres multibyte. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = chunks.length === 0 ? 75 : 74; // la continuación lleva un espacio al inicio
    if (size + bytes > limit) {
      chunks.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  chunks.push(current);
  return chunks.join('\r\n ');
}

/** Archivo `.ics` con un VEVENT y una alarma 10 minutos antes del inicio. */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zlotify//Claims//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@zlotify`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(event.startsAt))}`,
    `DTEND:${stamp(eventEnd(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(detailsText(event))}`,
    `URL:${event.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
