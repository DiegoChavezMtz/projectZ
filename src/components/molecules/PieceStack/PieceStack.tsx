import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { PriceCapsule } from '../../atoms/PriceCapsule';
import type { PieceState } from '../../atoms/StatePill';
import { PieceFrame } from '../PieceFrame';
import styles from './PieceStack.module.css';

export type StackPiece = { src?: string | null; alt?: string; media?: ReactNode };

type Props = {
  /** Pieza de enfrente + hasta dos detrás (las de fondo son decorativas: `alt=""`). */
  front: StackPiece;
  back?: ReadonlyArray<StackPiece>;
  /** Estado de la pieza de enfrente (la etiqueta puede sobreescribirse: «Tuya»). */
  state?: { kind: PieceState; label: string };
  /** Cápsula con nombre y precio sobre la pieza de enfrente. */
  caption?: { name: string; price: string };
  /** Ancho de la pieza de enfrente y cuánto sobresale del bloque (px o cualquier longitud CSS). */
  width?: string;
  overlap?: string;
  /** Pila a la izquierda en vez de a la derecha. */
  left?: boolean;
  /** Se asienta una vez al aparecer (solo con movimiento permitido). */
  settle?: boolean;
  className?: string;
};

/** Pila inclinada de piezas: frente + dos detrás. Decorativa salvo la pieza de enfrente. */
export function PieceStack({
  front,
  back = [],
  state,
  caption,
  width,
  overlap,
  left = false,
  settle = false,
  className,
}: Props) {
  const style = {
    ...(width ? { '--pw': width } : null),
    ...(overlap ? { '--ov': overlap } : null),
  } as CSSProperties;
  return (
    <div
      className={clsx(styles.root, left && styles.left, settle && styles.settle, className)}
      style={style}
    >
      {back[1] ? (
        <PieceFrame
          className={clsx(styles.piece, styles.back2)}
          src={back[1].src}
          media={back[1].media}
          alt=""
        />
      ) : null}
      {back[0] ? (
        <PieceFrame
          className={clsx(styles.piece, styles.back1)}
          src={back[0].src}
          media={back[0].media}
          alt=""
        />
      ) : null}
      <PieceFrame
        className={clsx(styles.piece, styles.front, !caption && styles.noCaption)}
        src={front.src}
        media={front.media}
        alt={front.alt ?? ''}
        state={state}
        priority
      >
        {caption ? (
          <span className={styles.caption}>
            <span className={styles.name}>{caption.name}</span>
            <PriceCapsule variant="plain" className={styles.price}>
              {caption.price}
            </PriceCapsule>
          </span>
        ) : null}
      </PieceFrame>
    </div>
  );
}
