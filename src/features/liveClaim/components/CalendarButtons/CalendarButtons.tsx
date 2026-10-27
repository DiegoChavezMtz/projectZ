import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { liveClaimContent } from '../../content/es-MX';
import { buildGoogleCalendarUrl, type CalendarEvent } from '../../utils/calendar';
import styles from './CalendarButtons.module.css';

const c = liveClaimContent.calendar;

export function CalendarButtons({ event, code }: { event: CalendarEvent; code: string }) {
  return (
    <section className={styles.root} aria-label={c.heading}>
      <div className={styles.buttons}>
        <Button
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
        >
          <Icon name="calendar" /> {c.google}
        </Button>
        <Button href={`/c/${code}/calendar.ics`} download variant="secondary">
          <Icon name="calendar" /> {c.ics}
        </Button>
      </div>
      <Text size="sm" tone="muted">
        {c.note}
      </Text>
    </section>
  );
}
