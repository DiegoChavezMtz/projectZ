import clsx from 'clsx';
import Link from 'next/link';
import styles from './KpiTile.module.css';

type Props = {
  href: string;
  value: number;
  label: string;
  color: 'orange' | 'jade' | 'pink' | 'grey';
  className?: string;
};

/** Conteo estático con enlace (sin pulsos ni contadores en vivo): número en mono + etiqueta. */
export function KpiTile({ href, value, label, color, className }: Props) {
  return (
    <Link href={href} className={clsx(styles.root, styles[color], className)}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </Link>
  );
}
