import type { HTMLAttributes } from 'react';
import styles from './VisuallyHidden.module.css';

export function VisuallyHidden({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={[styles.root, className].filter(Boolean).join(' ')} {...rest} />;
}
