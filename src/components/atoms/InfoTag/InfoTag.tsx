import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './InfoTag.module.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** `ink`: tinta con texto marfil (sobre bloques de color). `soft`: superficie marfil (sobre la página). */
  tone?: 'ink' | 'soft';
};

/** Dato corto en mono mayúsculas (hora, condición, idioma). */
export function InfoTag({ tone = 'soft', className, ...rest }: Props) {
  return <span className={clsx(styles.root, styles[tone], className)} {...rest} />;
}
