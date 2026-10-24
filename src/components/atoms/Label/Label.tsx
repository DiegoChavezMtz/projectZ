import type { LabelHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Label.module.css';

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx(styles.root, className)} {...rest} />;
}
