import clsx from 'clsx';
import type { ElementType, HTMLAttributes } from 'react';
import styles from './Panel.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: 'default' | 'raised';
};

export function Panel({ as: Tag = 'div', tone = 'default', className, ...rest }: Props) {
  return <Tag className={clsx(styles.root, styles[tone], className)} {...rest} />;
}
