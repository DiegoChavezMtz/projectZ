'use client';

import { useState } from 'react';
import { Panel } from '@/components/molecules/Panel';
import { Text } from '@/components/atoms/Text';
import type { ClaimItem } from '@/types/claims';
import { liveClaimContent } from '../../content/es-MX';
import type { LiveState, LiveSnapshot, Viewer, CategoryView } from '../../types';
import { sessionCalendarEvent } from '../../utils/session';
import { CalendarButtons } from '../CalendarButtons';
import { Countdown } from '../Countdown';
import { EventHeader } from '../EventHeader';
import { HowItWorksPanel } from '../HowItWorksPanel';
import { ItemGrid } from '../ItemGrid';
import styles from './ScheduledView.module.css';

const c = liveClaimContent;
const noop = () => undefined;

type Props = {
  state: LiveState;
  seller: LiveSnapshot['seller'];
  viewer: Viewer;
  isOwner: boolean;
  category: CategoryView;
  eventUrl: string;
  clock: { offsetMs: number; ready: boolean };
};

/** Portada antes de empezar: horario, cuenta regresiva, reglas, calendario y adelanto de artículos. */
export function ScheduledView({ state, seller, viewer, isOwner, category, eventUrl, clock }: Props) {
  const { session, items } = state;
  const [startReached, setStartReached] = useState(false);

  return (
    <div className={styles.root}>
      {session.status === 'draft' ? (
        <Panel tone="raised" role="note">
          <Text>{c.cover.previewNotice}</Text>
        </Panel>
      ) : null}

      <EventHeader session={session} seller={seller}>
        {startReached ? (
          <Text role="status">{c.countdown.waitingSeller}</Text>
        ) : (
          <Countdown
            target={session.starts_at}
            offsetMs={clock.offsetMs}
            ready={clock.ready}
            label={c.countdown.startsIn}
            onReach={() => setStartReached(true)}
          />
        )}
        {session.closes_at ? (
          <Countdown
            target={session.closes_at}
            offsetMs={clock.offsetMs}
            ready={clock.ready}
            label={c.countdown.closesIn}
          />
        ) : null}
      </EventHeader>

      {session.allow_accumulate ? (
        <Text size="sm" tone="muted">
          {c.cover.guardadito(session.accumulate_days)}
        </Text>
      ) : null}

      {session.rules ? (
        <section aria-labelledby="rules-title" className={styles.rules}>
          <h2 id="rules-title" className={styles.heading}>
            {c.cover.rules}
          </h2>
          <Text tone="muted" className={styles.preline}>
            {session.rules}
          </Text>
        </section>
      ) : null}

      <CalendarButtons event={sessionCalendarEvent(session, eventUrl, c.calendar.eventDescription)} code={session.code} />

      <HowItWorksPanel showGuardadito={session.allow_accumulate} />

      <section aria-labelledby="preview-title" className={styles.preview}>
        <h2 id="preview-title" className={styles.heading}>
          {c.cover.previewItems}
        </h2>
        {items.length === 0 ? (
          <Text tone="muted">{c.cover.noPreview}</Text>
        ) : (
          <ItemGrid
            items={items}
            category={category}
            sessionStatus={session.status}
            viewer={viewer}
            isOwner={isOwner}
            entries={state.entries}
            pending={state.pending}
            onClaim={noop as (item: ClaimItem) => void}
            onOffer={noop as (item: ClaimItem) => void}
            onWithdraw={noop}
          />
        )}
      </section>
    </div>
  );
}
