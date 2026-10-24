import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './Skeleton.module.css';

type Props = HTMLAttributes<HTMLDivElement> & { width?: string; height?: string };

export function Skeleton({ width, height, className, style, ...rest }: Props) {
  return (
    <div
      className={clsx(styles.root, className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}
