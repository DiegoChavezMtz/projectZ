import clsx from 'clsx';
import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { common } from '@/content/es-MX';
import { formatMonthYear } from '@/utils/dates';
import styles from './ReputationBadge.module.css';

type Props = {
  /** Handle del usuario: enlaza a `/u/[handle]`. */
  handle: string;
  /** Nombre visible, solo para el texto accesible del enlace. */
  name?: string;
  /** Claims ganados (comprador) o entregados (vendedor). */
  winsCount: number;
  /** ISO de `profiles.created_at`. Sin él (p. ej. datos desnormalizados) se omite la antigüedad. */
  memberSince?: string | null;
  isSeller: boolean;
  rating?: { average: number; count: number } | null;
  /** 0 a 1; null o ausente cuando hay menos de 3 casos. */
  paidOnTimeRate?: number | null;
  /** Sin historial: se muestra "Nuevo" en lugar de las cifras. */
  isNew?: boolean;
  compact?: boolean;
  className?: string;
};

const c = common.reputationBadge;

export function ReputationBadge({
  handle,
  name,
  winsCount,
  memberSince,
  isSeller,
  rating,
  paidOnTimeRate,
  isNew = false,
  compact = false,
  className,
}: Props) {
  const label = c.link(name ?? handle);
  const since = memberSince ? c.since(formatMonthYear(memberSince)) : null;

  if (isNew) {
    return (
      <Link
        href={`/u/${encodeURIComponent(handle)}`}
        className={clsx(styles.root, compact && styles.compact, className)}
        aria-label={`${label}. ${c.newHint}`}
        title={c.newHint}
      >
        <Badge tone="info">{c.isNew}</Badge>
        {!compact && since && <span className={styles.muted}>{since}</span>}
      </Link>
    );
  }

  const wins = isSeller ? c.winsSeller(winsCount) : c.winsBuyer(winsCount);
  const average = rating ? rating.average.toFixed(1) : null;
  const pct = paidOnTimeRate == null ? null : Math.round(paidOnTimeRate * 100);

  return (
    <Link
      href={`/u/${encodeURIComponent(handle)}`}
      className={clsx(styles.root, compact && styles.compact, className)}
      aria-label={label}
    >
      {isSeller && !compact && <Badge tone="accent">{c.seller}</Badge>}
      {average && (
        <span className={styles.rating} aria-label={c.rating(average)}>
          <span aria-hidden="true">★</span> {average}
        </span>
      )}
      <span className={styles.item}>{wins}</span>
      {!compact && pct !== null && <span className={styles.item}>{c.paidOnTime(pct)}</span>}
      {!compact && since && <span className={styles.muted}>{since}</span>}
    </Link>
  );
}
