import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
};

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  return <span className={clsx(styles.root, styles[tone], className)} {...rest} />;
}
