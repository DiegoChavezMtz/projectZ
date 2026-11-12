import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '../../atoms/BrandMark';
import styles from './AppBar.module.css';

type Props = {
  /** Enlace de regreso (píldora de contorno). */
  back?: { href: string; label: string };
  /** Muestra la marca (por defecto sí cuando no hay enlace de regreso). */
  brand?: { href: string; label: string; name: string } | null;
  /** Slot derecho (acciones, interruptor de movimiento). */
  children?: ReactNode;
  className?: string;
};

/** Barra superior de una pantalla: regreso o marca a la izquierda, acciones a la derecha. */
export function AppBar({ back, brand, children, className }: Props) {
  return (
    <div className={clsx(styles.root, className)}>
      {back ? (
        <Link href={back.href} className={styles.back}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      ) : brand ? (
        <Link href={brand.href} className={styles.logo} aria-label={brand.label}>
          <BrandMark />
          <span>{brand.name}</span>
        </Link>
      ) : (
        <span />
      )}
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
