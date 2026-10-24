'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { common } from '@/content/es-MX';
import { Icon } from '../../atoms/Icon';
import styles from './SiteHeader.module.css';

type Props = {
  nav: ReadonlyArray<{ label: string; href: string }>;
  actions: ReactNode;
};

/** Menú de navegación para <768px: botón con `aria-expanded`, cierra con Escape y al navegar. */
export function MobileMenu({ nav, actions }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className={styles.mobile} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? common.site.closeMenu : common.site.openMenu}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? 'close' : 'menu'} size="1.5em" />
      </button>
      <div
        id={panelId}
        className={styles.panel}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <nav aria-label={common.site.mainNavLabel}>
          <ul className={styles.mobileLinks}>
            {nav.map((item) => (
              <li key={item.href}>
                <a className={styles.mobileLink} href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.mobileActions}>{actions}</div>
      </div>
    </div>
  );
}
