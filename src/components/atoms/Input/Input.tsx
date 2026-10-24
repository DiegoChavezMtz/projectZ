import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid = false, className, ...rest }: Props) {
  return (
    <input className={clsx(styles.root, className)} aria-invalid={invalid || undefined} {...rest} />
  );
}
