import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './Heading.module.css';

type Level = 1 | 2 | 3 | 4 | 5 | 6;
type Size = 'display' | 'xl' | 'lg' | 'md' | 'sm';

type Props = HTMLAttributes<HTMLHeadingElement> & {
  level: Level;
  /** Tamaño visual; por defecto sigue al nivel semántico. */
  size?: Size;
};

const defaultSize: Record<Level, Size> = {
  1: 'display',
  2: 'xl',
  3: 'lg',
  4: 'md',
  5: 'sm',
  6: 'sm',
};

export function Heading({ level, size, className, ...rest }: Props) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={clsx(styles.root, styles[size ?? defaultSize[level]], className)} {...rest} />
  );
}
