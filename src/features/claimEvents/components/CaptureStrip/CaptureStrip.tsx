'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';
import { scannerContent, type ItemLabels } from '../../content/scanner';
import styles from './CaptureStrip.module.css';

const c = scannerContent.strip;

export type StripStatus = 'processing' | 'queued' | 'uploading' | 'done' | 'error';

export type StripItem = {
  id: string;
  status: StripStatus;
  /** URL de objeto de la miniatura (la libera quien la crea). */
  thumbUrl?: string;
  priceCents: number | null;
  errorCode?: string | null;
};

type Props = {
  items: readonly StripItem[];
  aspect: { width: number; height: number };
  labels: ItemLabels;
  offline?: boolean;
  onRetry: (id: string) => void;
  onRepeatLast: () => void;
  onRemoveLast: () => void;
};

const announce: Record<StripStatus, (n: number) => string> = c.announce;

/**
 * Tira de miniaturas con el estado de cada captura (procesando, subiendo, lista, error), reintento y las
 * acciones sobre la última captura. Cada cambio de estado se anuncia por `aria-live`.
 */
export function CaptureStrip({
  items,
  aspect,
  labels,
  offline = false,
  onRetry,
  onRepeatLast,
  onRemoveLast,
}: Props) {
  const previous = useRef(new Map<string, StripStatus>());
  const [message, setMessage] = useState('');

  useEffect(() => {
    const seen = previous.current;
    let latest = '';
    items.forEach((item, index) => {
      if (seen.get(item.id) !== item.status) latest = announce[item.status](index + 1);
    });
    const removed = [...seen.keys()].filter((id) => !items.some((item) => item.id === id));
    if (removed.length > 0 && !latest) latest = c.announce.removed(items.length + 1);
    previous.current = new Map(items.map((item) => [item.id, item.status]));
    if (latest) setMessage(latest);
  }, [items]);

  const pending = items.filter(
    (i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'processing',
  ).length;
  const last = items[items.length - 1];

  return (
    <section className={styles.root} aria-labelledby="strip-heading">
      <div className={styles.header}>
        <Heading level={2} size="md" id="strip-heading">
          {c.heading}
        </Heading>
        <Text size="sm" tone="muted">
          {c.count(items.length, labels)}
        </Text>
      </div>
      <div role="status" aria-live="polite" className={styles.live}>
        <VisuallyHidden>{message}</VisuallyHidden>
      </div>
      {offline ? (
        <Text size="sm" role="status">
          {c.offline}
        </Text>
      ) : null}
      {pending > 0 ? (
        <Text size="sm" tone="muted">
          {c.pending(pending)}
        </Text>
      ) : null}

      {items.length === 0 ? (
        <Text tone="muted">{c.empty}</Text>
      ) : (
        <ol className={styles.list}>
          {items.map((item, index) => (
            <li
              key={item.id}
              className={styles.item}
              data-status={item.status}
              data-testid="strip-item"
            >
              <Picture
                className={styles.thumb}
                aspect={aspect}
                src={item.thumbUrl}
                alt={c.thumb(index + 1, c.status[item.status] ?? item.status)}
                placeholder={String(index + 1)}
              />
              <Badge
                tone={
                  item.status === 'done'
                    ? 'success'
                    : item.status === 'error'
                      ? 'danger'
                      : 'neutral'
                }
                className={styles.status}
              >
                {c.status[item.status]}
              </Badge>
              {item.priceCents === null && item.status !== 'processing' ? (
                <Badge tone="warning">{c.noPrice}</Badge>
              ) : null}
              {item.status === 'error' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onRetry(item.id)}
                >
                  {c.retry}
                  <VisuallyHidden> {index + 1}</VisuallyHidden>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {last && ['done', 'queued', 'error'].includes(last.status) ? (
        <div className={styles.actions} role="group" aria-label={c.lastActions}>
          <Button type="button" variant="secondary" size="sm" onClick={onRepeatLast}>
            {c.repeatLast}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemoveLast}>
            {c.removeLast}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
