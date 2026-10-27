'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import type { SessionFeedEvent } from '@/types/claims';
import { formatTime } from '@/utils/dates';
import { liveClaimContent } from '../../content/es-MX';
import { formatFeedEvent, type FeedLabels } from '../../utils/feed';
import styles from './ActivityFeed.module.css';

const c = liveClaimContent.feed;
const BOTTOM_TOLERANCE_PX = 32;

type Props = { events: SessionFeedEvent[]; noun: FeedLabels['noun'] };

/**
 * Feed factual del evento. Si la persona está leyendo lo anterior no se le mueve el scroll: aparece
 * un indicador de novedades. Sin sonidos ni parpadeos.
 */
function ActivityFeedBase({ events, noun }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastSeenId = useRef(events.at(-1)?.id ?? 0);
  const [unseen, setUnseen] = useState(0);
  const labels: FeedLabels = { noun, texts: c.texts };
  const lastId = events.at(-1)?.id ?? 0;

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
      lastSeenId.current = lastId;
    }
  }, [lastId]);

  useEffect(() => {
    // Derivado del scroll: cuántas novedades llegaron mientras leía arriba.
    setUnseen(
      atBottom.current ? 0 : events.filter((event) => event.id > lastSeenId.current).length,
    );
  }, [events, lastId]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_TOLERANCE_PX;
    if (atBottom.current) {
      lastSeenId.current = lastId;
      setUnseen(0);
    }
  }

  function jump() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    lastSeenId.current = lastId;
    setUnseen(0);
  }

  return (
    <section className={styles.root} aria-label={c.region}>
      <div
        ref={listRef}
        className={styles.list}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        tabIndex={0}
      >
        {events.length === 0 ? (
          <Text tone="muted" size="sm">
            {c.empty}
          </Text>
        ) : (
          <ol className={styles.items}>
            {events.map((event) => (
              <li key={event.id} className={styles.item}>
                <time className={styles.time} dateTime={event.created_at}>
                  {formatTime(event.created_at)}
                </time>
                <span>{formatFeedEvent(event, labels)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {unseen > 0 ? (
        <Button size="sm" variant="secondary" onClick={jump} className={styles.jump}>
          {c.newItems(unseen)} · {c.jump}
        </Button>
      ) : null}
    </section>
  );
}

export const ActivityFeed = memo(ActivityFeedBase);
