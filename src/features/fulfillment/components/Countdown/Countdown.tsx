'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { formatDateTime } from '@/utils/dates';
import { fulfillmentContent } from '../../content/es-MX';
import { deadlineStatus, formatRemaining } from '../../utils/deadlines';
import styles from './Countdown.module.css';

const TICK_MS = 60_000;
const c = fulfillmentContent.common;

/**
 * Fecha límite con cuenta regresiva informativa (se actualiza cada minuto). Sin tono de urgencia:
 * el color solo cambia con suavidad cuando queda poco o ya venció.
 */
export function Countdown({ dueAt }: { dueAt: string }) {
  // Hasta montar solo se muestra la fecha: evita diferencias entre servidor y navegador.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const status = now === null ? null : deadlineStatus(dueAt, now);

  return (
    <p
      className={clsx(
        styles.root,
        status?.state === 'soon' && styles.soon,
        status?.state === 'overdue' && styles.overdue,
      )}
    >
      <time dateTime={dueAt}>{c.due(formatDateTime(dueAt))}</time>
      {status && status.state !== 'none' ? (
        <span className={styles.remaining}>
          {' · '}
          {status.state === 'overdue' ? c.overdue : c.dueIn(formatRemaining(status.remainingMs))}
        </span>
      ) : null}
    </p>
  );
}
