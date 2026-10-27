'use client';

import { memo, useLayoutEffect, useRef } from 'react';
import { Text } from '@/components/atoms/Text';
import type { SessionFeedEvent } from '@/types/claims';
import { formatTime } from '@/utils/dates';
import { formatFeedEvent, type FeedLabels } from '@/utils/feedFormat';
import { liveConsoleContent } from '../../content/es-MX';
import styles from './ConsoleFeed.module.css';

const c = liveConsoleContent.feed;

type Props = { events: SessionFeedEvent[]; noun: FeedLabels['noun'] };

/** Feed factual del evento; los más recientes arriba para leerlos sin hacer scroll. */
function ConsoleFeedBase({ events, noun }: Props) {
  const labels: FeedLabels = { noun, texts: c.texts };
  const listRef = useRef<HTMLOListElement>(null);
  const lastId = events.at(-1)?.id ?? 0;

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [lastId]);

  if (events.length === 0)
    return (
      <Text tone="muted" size="sm">
        {c.empty}
      </Text>
    );

  return (
    <ol ref={listRef} className={styles.list} aria-label={c.region} tabIndex={0}>
      {[...events].reverse().map((event) => (
        <li key={event.id} className={styles.item}>
          <time className={styles.time} dateTime={event.created_at}>
            {formatTime(event.created_at)}
          </time>
          <span>{formatFeedEvent(event, labels)}</span>
        </li>
      ))}
    </ol>
  );
}

export const ConsoleFeed = memo(ConsoleFeedBase);
