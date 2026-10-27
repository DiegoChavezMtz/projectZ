import 'server-only';
import { getSiteUrl } from '@/utils/site';
import { liveClaimContent } from '../content/es-MX';
import { buildIcs } from '../utils/calendar';
import { sessionCalendarEvent, sessionPath } from '../utils/session';
import { snapshotService } from './snapshot.service';

export const calendarService = {
  /** Archivo `.ics` del evento publicado con ese código, o null si no existe o no es público. */
  async getIcs(code: string): Promise<{ filename: string; body: string } | null> {
    const session = await snapshotService.getPublishedSession(code);
    if (!session) return null;
    const url = `${getSiteUrl()}${sessionPath(session.code)}`;
    return {
      filename: `claim-${session.code}.ics`,
      body: buildIcs(sessionCalendarEvent(session, url, liveClaimContent.calendar.eventDescription)),
    };
  },
};
