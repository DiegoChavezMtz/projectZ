import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './ScreenHeader.module.css';

export type HeaderColor = 'orange' | 'jade' | 'pink' | 'grey';

type Props = {
  color?: HeaderColor;
  /** `side`: pila al lado del titular. `big`: titular enorme y pila abajo. `plain`: sin pila. */
  variant?: 'side' | 'big' | 'plain';
  /** Línea pequeña sobre el titular (mono). */
  kicker?: ReactNode;
  title: ReactNode;
  /** Titular como h1 (por defecto) o h2 si la página ya tiene h1 propio. */
  titleAs?: 'h1' | 'h2';
  lead?: ReactNode;
  /** Etiquetas (`InfoTag`) bajo el texto. */
  meta?: ReactNode;
  /** Barra superior (`AppBar`). */
  bar?: ReactNode;
  /** `PieceStack` u otra ilustración que sobresale del bloque. */
  stack?: ReactNode;
  /** Celebración: el bloque ocupa casi toda la pantalla. */
  celebrate?: boolean;
  /** Bloque redondeado dentro de la página (no a todo el ancho). */
  contained?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Bloque de color que abre una pantalla: titular Anton enorme + pila que sale hacia el cuerpo. */
export function ScreenHeader({
  color = 'orange',
  variant = 'plain',
  kicker,
  title,
  titleAs: Title = 'h1',
  lead,
  meta,
  bar,
  stack,
  celebrate = false,
  contained = false,
  className,
  children,
}: Props) {
  return (
    <header
      data-block={color}
      className={clsx(
        styles.root,
        styles[variant],
        celebrate && styles.celebrate,
        contained && styles.contained,
        className,
      )}
    >
      <div className={styles.wrap}>
        {bar}
        <div className={styles.text}>
          {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
          <Title className={styles.title}>{title}</Title>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {children}
        </div>
        {stack}
      </div>
    </header>
  );
}
