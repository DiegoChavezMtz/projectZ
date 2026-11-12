import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PriceCapsule.module.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  /** `capsule` (por defecto): precio mono naranja sobre tinta. `plain`: precio mono en tinta, sin fondo. */
  variant?: 'capsule' | 'plain';
};

/** Precio en mono. En cápsula oscura se lee sobre cualquier fondo (naranja sobre tinta 8.0:1). */
export function PriceCapsule({ variant = 'capsule', className, ...rest }: Props) {
  return <span className={clsx(styles.root, styles[variant], className)} {...rest} />;
}
