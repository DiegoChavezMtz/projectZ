'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { common } from '@/content/es-MX';
import { Avatar } from '../../atoms/Avatar';
import { MotionSwitch } from '../MotionSwitch';
import styles from './UserMenu.module.css';

type Props = {
  name: string;
  email?: string | null;
  avatarSrc?: string | null;
  links: ReadonlyArray<{ label: string; href: string }>;
  /** Acción de cerrar sesión (formulario con Server Action); la inyecta quien conoce la sesión. */
  signOut: ReactNode;
};

/**
 * Menú de usuario de la barra: avatar de 44 px que abre un panel con perfil, seguridad, interruptor de
 * movimiento (solo en móvil, donde no cabe en la barra) y cerrar sesión. Escape o clic fuera lo cierran.
 */
export function UserMenu({ name, email, avatarSrc, links, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const first = rootRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${common.app.userMenu.label}: ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar size="md" name={name} src={avatarSrc} className={styles.avatar} />
      </button>
      <div
        id={panelId}
        className={styles.panel}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <div className={styles.who}>
          <b>{name}</b>
          {email ? <span>{email}</span> : null}
        </div>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.item}>
            {link.label}
          </Link>
        ))}
        <hr className={styles.rule} />
        <MotionSwitch className={styles.motion} />
        {signOut}
      </div>
    </div>
  );
}
