'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { common } from '@/content/es-MX';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useStoredFlag } from '@/hooks/useStoredFlag';
import { APP_SECTIONS, SETUP_ITEM, isItemActive, sectionForPath } from '@/utils/appNav';
import { BrandMark } from '../../atoms/BrandMark';
import { Icon } from '../../atoms/Icon';
import { MotionSwitch } from '../../molecules/MotionSwitch';
import styles from './AppNav.module.css';

const c = common.app;

type Props = { userMenu: ReactNode; shopLocked: boolean; children: ReactNode };

/**
 * Barra superior + menú lateral flotante (UX de Diseño `app-shell`):
 * - ≥ 1024 px: panel de 232 px (o riel de 64 px si se contrae; preferencia en `localStorage`), empuja el contenido.
 * - 768–1023 px: riel de 64 px; al expandir flota encima con velo; Escape o elegir un ítem lo cierra.
 * - < 768 px: oculto; botón «Menú» abajo a la izquierda abre un panel con velo, foco atrapado y Escape.
 */
export function AppNav({ userMenu, shopLocked, children }: Props) {
  const pathname = usePathname();
  const activeSection = sectionForPath(pathname);
  const section = APP_SECTIONS.find((s) => s.id === activeSection) ?? APP_SECTIONS[0]!;
  const locked = activeSection === 'shop' && shopLocked;
  const items = locked ? [SETUP_ITEM, ...section.items] : section.items;

  const isWide = useMediaQuery('(min-width: 1024px)');
  const [railPreferred, setRailPreferred] = useStoredFlag('zl-smenu-rail');
  const [openPath, setOpenPath] = useState<string | null>(null); // panel móvil / flotante en tableta
  const open = openPath === pathname; // navegar lo cierra
  const sideId = useId();
  const sideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const expanded = isWide ? !railPreferred : open;
  const closePanel = (returnFocusTo?: HTMLElement | null) => {
    setOpenPath(null);
    returnFocusTo?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closePanel(toggleRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Móvil con el panel expandido: el foco no sale del panel (Tab cicla entre sus controles).
  const trapFocus = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !open || !window.matchMedia('(max-width: 767px)').matches) return;
    const focusable = [
      ...(sideRef.current?.querySelectorAll<HTMLElement>('a:not([aria-disabled="true"]), button') ??
        []),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleRail = () =>
    isWide ? setRailPreferred(!railPreferred) : setOpenPath(open ? null : pathname);

  const sectionLabel = c.sections[section.id];

  return (
    <div
      className={styles.root}
      data-rail={isWide && railPreferred ? 'true' : undefined}
      onKeyDown={trapFocus}
    >
      <a className={styles.skip} href="#contenido">
        {c.skipToContent}
      </a>
      <header className={styles.bar} data-block="orange">
        <div className={styles.barRow}>
          <Link href="/app" className={styles.logo} aria-label={c.homeLabel}>
            <BrandMark width={36} height={36} />
            <span className={styles.word}>{common.appName}</span>
          </Link>
          <nav className={styles.sections} aria-label={c.sectionsLabel}>
            {APP_SECTIONS.map((s) => {
              const active = s.id === activeSection;
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  className={styles.tab}
                  aria-current={active ? 'page' : undefined}
                >
                  {c.sections[s.id]}
                </Link>
              );
            })}
          </nav>
          <div className={styles.end}>
            <MotionSwitch tone="on-ink" className={styles.barSwitch} />
            {userMenu}
          </div>
        </div>
      </header>

      <aside
        id={sideId}
        ref={sideRef}
        className={clsx(styles.side, open && styles.sideOpen)}
        data-wide={expanded ? 'true' : 'false'}
        aria-label={c.sideLabel(sectionLabel)}
      >
        <div className={styles.sideTop}>
          <span className={styles.sideLabel}>{sectionLabel}</span>
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            aria-controls={sideId}
            aria-label={expanded ? c.collapse : c.expand}
            onClick={toggleRail}
          >
            <Icon name={expanded ? 'chevronLeft' : 'chevronRight'} size="1.5rem" />
          </button>
        </div>
        <nav aria-label={sectionLabel}>
          <ul className={styles.items}>
            {items.map((item) => {
              const isSetup = item === SETUP_ITEM;
              const disabled = locked && !isSetup;
              const active = !disabled && isItemActive(pathname, item);
              const label = c.items[item.labelKey];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={styles.item}
                    aria-current={active ? 'page' : undefined}
                    aria-disabled={disabled ? 'true' : undefined}
                    title={expanded ? undefined : label}
                    onClick={(event) => {
                      if (disabled) event.preventDefault();
                      else if (!isWide) setOpenPath(null);
                    }}
                  >
                    <Icon name={item.icon} size="1.5rem" />
                    <span className={styles.label}>{label}</span>
                    {disabled ? (
                      <>
                        <Icon name="lock" size="1.1rem" className={styles.lock} />
                        <span className={styles.srOnly}>{c.locked}</span>
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.sideFoot}>
          <MotionSwitch className={styles.sideSwitch} />
        </div>
      </aside>

      {open ? (
        <div
          className={styles.scrim}
          aria-hidden="true"
          onClick={() => closePanel(toggleRef.current)}
        />
      ) : null}

      <main id="contenido" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
