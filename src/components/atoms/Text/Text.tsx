import clsx from 'clsx';
import type { ElementType, HTMLAttributes } from 'react';
import styles from './Text.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'muted' | 'accent' | 'danger';
};

export function Text({ as: Tag = 'p', size = 'md', tone = 'default', className, ...rest }: Props) {
  return <Tag className={clsx(styles.root, styles[size], styles[tone], className)} {...rest} />;
}
