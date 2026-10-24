import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ invalid = false, className, rows = 4, ...rest }: Props) {
  return (
    <textarea
      className={clsx(styles.root, className)}
      rows={rows}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
