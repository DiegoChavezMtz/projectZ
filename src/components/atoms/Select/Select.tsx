import clsx from 'clsx';
import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid = false, className, children, ...rest }: Props) {
  return (
    <select className={clsx(styles.root, className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}
