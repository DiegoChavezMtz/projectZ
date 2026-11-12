import clsx from 'clsx';
import type { ReactNode } from 'react';
import { StatePill, type PieceState } from '../../atoms/StatePill';
import styles from './PieceFrame.module.css';

type Props = {
  src?: string | null;
  /** Vacío para fotos decorativas (piezas de fondo de una pila). */
  alt: string;
  /** Relación ancho:alto; por defecto la de la pieza (63:88). */
  aspect?: { width: number; height: number };
  /** Estado pegado abajo a la izquierda sobre la foto. */
  state?: { kind: PieceState; label: string };
  /** `thumb`: miniatura de fila (marco y radio reducidos, sin estado). */
  size?: 'full' | 'thumb';
  priority?: boolean;
  /** Texto del recuadro cuando aún no hay foto. */
  placeholder?: string;
  /** Sustituye la <img> (por ejemplo `next/image` con `fill`). Se recorta con `object-fit: cover`. */
  media?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Marco mate + foto 63:88 con `object-fit: cover` (absorbe fotos de calidad variable) + estado. */
export function PieceFrame({
  src,
  alt,
  aspect,
  state,
  size = 'full',
  priority = false,
  placeholder,
  media,
  className,
  children,
}: Props) {
  const ratio = aspect ? `${aspect.width} / ${aspect.height}` : 'var(--zl-ratio-card)';
  return (
    <div
      className={clsx(styles.root, size === 'thumb' && styles.thumb, className)}
      style={{ aspectRatio: ratio }}
    >
      {media ? (
        <span className={styles.media}>{media}</span>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en el bucket público o blob local.
        <img
          className={styles.image}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      ) : (
        <span className={styles.placeholder}>{placeholder}</span>
      )}
      {state && size === 'full' ? (
        <StatePill state={state.kind} className={styles.state}>
          {state.label}
        </StatePill>
      ) : null}
      {children}
    </div>
  );
}
