import type { ClaimSession } from '@/types/claims';
import type { CalendarEvent } from './calendar';

export const sessionPath = (code: string) => `/c/${code}`;

/** Evento de calendario de un claim (inicio, cierre si existe y enlace directo). */
export function sessionCalendarEvent(
  session: Pick<
    ClaimSession,
    'id' | 'title' | 'description' | 'starts_at' | 'closes_at' | 'expected_duration_minutes'
  >,
  url: string,
  description?: string,
): CalendarEvent {
  return {
    uid: session.id,
    title: session.title,
    description: description ?? session.description,
    startsAt: session.starts_at,
    closesAt: session.closes_at,
    expectedDurationMinutes: session.expected_duration_minutes,
    url,
  };
}
