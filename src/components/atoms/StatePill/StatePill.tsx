import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './StatePill.module.css';

export type PieceState = 'available' | 'claimed' | 'offer' | 'sold' | 'mine';

type Props = HTMLAttributes<HTMLSpanElement> & {
  state: PieceState;
};

/** Estado de una pieza: relleno de color + punto/forma + texto (children). Nunca solo color. */
export function StatePill({ state, className, children, ...rest }: Props) {
  return (
    <span className={clsx(styles.root, styles[state], className)} data-state={state} {...rest}>
      {children}
    </span>
  );
}
