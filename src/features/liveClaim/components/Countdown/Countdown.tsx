'use client';

import { useEffect, useRef, useState } from 'react';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';
import { formatDateTime } from '@/utils/dates';
import { describeRemaining, formatRemaining } from '../../utils/clock';
import styles from './Countdown.module.css';

type Props = {
  /** Instante objetivo (ISO UTC). */
  target: string;
  /** Diferencia servidor − dispositivo (ver `useServerClock`). */
  offsetMs: number;
  /** false mientras no se ha medido el reloj: se muestra solo la fecha, sin cuenta. */
  ready: boolean;
  label: string;
  /** Se llama una vez cuando la cuenta llega a cero. */
  onReach?: () => void;
  /** Reloj inyectable para pruebas. */
  now?: () => number;
};

/**
 * Cuenta regresiva informativa: tipografía normal, sin pulso ni tono de alarma. Cada tick se
 * calcula contra la hora absoluta (servidor), así que no acumula drift. Respeta
 * `prefers-reduced-motion` por construcción: no anima nada.
 */
export function Countdown({ target, offsetMs, ready, label, onReach, now = Date.now }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const reached = useRef(false);
  const onReachRef = useRef(onReach);

  useEffect(() => {
    onReachRef.current = onReach;
  }, [onReach]);

  useEffect(() => {
    if (!ready) return;
    reached.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const serverNow = now() + offsetMs;
      const left = Math.max(0, Date.parse(target) - serverNow);
      setRemaining(left);
      if (left === 0) {
        if (!reached.current) {
          reached.current = true;
          onReachRef.current?.();
        }
        return;
      }
      // Alineado al siguiente segundo del servidor.
      timer = setTimeout(tick, (1000 - (serverNow % 1000)) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [target, offsetMs, ready, now]);

  return (
    <p className={styles.root}>
      <span className={styles.label}>{label}</span>{' '}
      {remaining === null ? (
        <time dateTime={target}>{formatDateTime(target)}</time>
      ) : (
        <>
          <time className={styles.time} dateTime={target} aria-hidden="true">
            {formatRemaining(remaining)}
          </time>
          <VisuallyHidden>{describeRemaining(remaining)}</VisuallyHidden>
        </>
      )}
    </p>
  );
}
