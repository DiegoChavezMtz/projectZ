import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Container } from '@/components/atoms/Container';
import styles from './Band.module.css';

export type BandColor = 'orange' | 'dark' | 'jade' | 'pink';

type Props = {
  color: BandColor;
  id?: string;
  /** id del titular que nombra la sección. */
  labelledBy?: string;
  /** `aria-label` cuando no hay titular visible. */
  label?: string;
  /** Reserva espacio abajo para una pila (`stack`) que cruza al siguiente bloque. */
  emits?: 'stack' | 'solo';
  /** Reserva espacio arriba: la sección anterior emite una pila que cruza hasta aquí. */
  receives?: 'stack' | 'solo' | 'hero';
  /** `PieceStack` que sobresale del borde inferior. */
  stack?: ReactNode;
  size?: 'default' | 'narrow';
  className?: string;
  children: ReactNode;
};

/** Bloque de color a todo el ancho: reasigna los tokens semánticos para que los átomos se lean sobre él. */
export function Band({
  color,
  id,
  labelledBy,
  label,
  emits,
  receives,
  stack,
  size = 'default',
  className,
  children,
}: Props) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      data-theme={color === 'dark' ? 'dark' : undefined}
      data-block={color === 'dark' ? undefined : color}
      className={clsx(
        styles.root,
        color === 'dark' && styles.dark,
        emits === 'stack' && styles.emitsStack,
        emits === 'solo' && styles.emitsSolo,
        receives && styles[`receives-${receives}`],
        className,
      )}
    >
      <Container size={size}>{children}</Container>
      {stack}
    </section>
  );
}
