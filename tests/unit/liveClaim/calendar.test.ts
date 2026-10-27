import { describe, expect, it } from 'vitest';
import {
  buildGoogleCalendarUrl,
  buildIcs,
  eventEnd,
  type CalendarEvent,
} from '@/features/liveClaim/utils/calendar';

const event: CalendarEvent = {
  uid: 'abc-123',
  title: 'Claim de viernes, Escarlata; y Púrpura',
  description: 'Reglas:\n24 h para pagar',
  startsAt: '2026-10-30T02:00:00.000Z',
  closesAt: '2026-10-31T14:00:00.000Z',
  url: 'https://zlotify.test/c/ABC123',
};

/** Parser mínimo de RFC 5545: despliega líneas y devuelve el árbol de componentes. */
type Component = { name: string; props: Array<[string, string]>; children: Component[] };
function parseIcs(text: string): Component {
  expect(text.endsWith('\r\n')).toBe(true);
  const raw = text.split('\r\n').slice(0, -1);
  const lines: string[] = [];
  for (const line of raw) {
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  const root: Component = { name: 'ROOT', props: [], children: [] };
  const stack = [root];
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':');
    if (key === 'BEGIN') {
      const component: Component = { name: value, props: [], children: [] };
      stack.at(-1)?.children.push(component);
      stack.push(component);
    } else if (key === 'END') {
      expect(stack.at(-1)?.name).toBe(value);
      stack.pop();
    } else {
      stack.at(-1)?.props.push([key ?? '', value]);
    }
  }
  expect(stack).toHaveLength(1); // todo BEGIN tiene su END
  return root;
}
const prop = (c: Component, name: string) => c.props.find(([key]) => key === name)?.[1];

describe('buildIcs', () => {
  const calendar = parseIcs(buildIcs(event, new Date('2026-10-26T12:00:00.000Z'))).children[0]!;
  const vevent = calendar.children[0]!;

  it('es un VCALENDAR válido con un VEVENT', () => {
    expect(calendar.name).toBe('VCALENDAR');
    expect(prop(calendar, 'VERSION')).toBe('2.0');
    expect(calendar.children.map((c) => c.name)).toEqual(['VEVENT']);
  });

  it('fechas en UTC con formato de calendario y UID estable', () => {
    expect(prop(vevent, 'UID')).toBe('abc-123@zlotify');
    expect(prop(vevent, 'DTSTAMP')).toBe('20261026T120000Z');
    expect(prop(vevent, 'DTSTART')).toBe('20261030T020000Z');
    expect(prop(vevent, 'DTEND')).toBe('20261031T140000Z');
  });

  it('incluye la URL del evento y escapa el texto', () => {
    expect(prop(vevent, 'URL')).toBe(event.url);
    expect(prop(vevent, 'SUMMARY')).toBe('Claim de viernes\\, Escarlata\; y Púrpura');
    expect(prop(vevent, 'DESCRIPTION')).toContain('Reglas:\\n24 h para pagar');
    expect(prop(vevent, 'DESCRIPTION')).toContain(event.url);
  });

  it('tiene alarma 10 minutos antes', () => {
    const alarm = vevent.children.find((c) => c.name === 'VALARM');
    expect(alarm).toBeDefined();
    expect(prop(alarm!, 'TRIGGER')).toBe('-PT10M');
    expect(prop(alarm!, 'ACTION')).toBe('DISPLAY');
  });

  it('pliega líneas largas sin partir caracteres', () => {
    const long = buildIcs({ ...event, title: 'Ñandú '.repeat(40) });
    expect(() => parseIcs(long)).not.toThrow();
    expect(prop(parseIcs(long).children[0]!.children[0]!, 'SUMMARY')).toBe(`${'Ñandú '.repeat(40)}`);
  });
});

describe('eventEnd', () => {
  it('usa el cierre, luego la duración esperada y luego 60 minutos', () => {
    expect(eventEnd(event).toISOString()).toBe('2026-10-31T14:00:00.000Z');
    expect(eventEnd({ ...event, closesAt: null, expectedDurationMinutes: 90 }).toISOString()).toBe('2026-10-30T03:30:00.000Z');
    expect(eventEnd({ ...event, closesAt: null }).toISOString()).toBe('2026-10-30T03:00:00.000Z');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('arma la plantilla con fechas y detalles', () => {
    const url = new URL(buildGoogleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(event.title);
    expect(url.searchParams.get('dates')).toBe('20261030T020000Z/20261031T140000Z');
    expect(url.searchParams.get('details')).toContain(event.url);
  });
});
