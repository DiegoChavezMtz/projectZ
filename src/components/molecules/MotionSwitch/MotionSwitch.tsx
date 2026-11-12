'use client';

import { useEffect, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { common } from '@/content/es-MX';
import {
  readStoredMotion,
  resolveMotion,
  storeMotion,
  type MotionPreference,
} from '@/utils/motion';
import styles from './MotionSwitch.module.css';

type Props = {
  className?: string;
  /** `on-ink`: sobre fondos de color (borde de tinta). Por defecto, sobre marfil u oscuro (borde marfil). */
  tone?: 'default' | 'on-ink';
};

/** Interruptor «Reducir movimiento»: fija `data-motion` en <html> y lo recuerda en este navegador. */
function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  return () => observer.disconnect();
}

function readAttribute(): MotionPreference {
  return document.documentElement.getAttribute('data-motion') === 'off' ? 'off' : 'on';
}

export function MotionSwitch({ className, tone = 'default' }: Props) {
  // La fuente de verdad es `data-motion` en <html> (la fija el script previo al pintado).
  const motion = useSyncExternalStore(subscribe, readAttribute, () => 'on' as const);

  useEffect(() => {
    const root = document.documentElement;
    const attr = root.getAttribute('data-motion');
    if (attr === 'on' || attr === 'off') return;
    root.setAttribute(
      'data-motion',
      resolveMotion(
        readStoredMotion(window.localStorage),
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      ),
    );
  }, []);

  const reduced = motion === 'off';

  function toggle() {
    const next: MotionPreference = reduced ? 'on' : 'off';
    document.documentElement.setAttribute('data-motion', next);
    storeMotion(window.localStorage, next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={reduced}
      className={clsx(styles.root, tone === 'on-ink' && styles.onInk, className)}
      onClick={toggle}
    >
      {common.motion.label}
      <span className={styles.state}>{reduced ? common.motion.on : common.motion.off}</span>
    </button>
  );
}
