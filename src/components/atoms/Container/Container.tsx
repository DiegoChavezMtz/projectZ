import clsx from 'clsx';
import type { ElementType, HTMLAttributes } from 'react';
import styles from './Container.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  size?: 'default' | 'narrow';
};

export function Container({ as: Tag = 'div', size = 'default', className, ...rest }: Props) {
  return <Tag className={clsx(styles.root, styles[size], className)} {...rest} />;
}
