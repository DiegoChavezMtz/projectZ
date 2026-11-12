'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select } from '../../atoms/Select';
import { VisuallyHidden } from '../../atoms/VisuallyHidden';
import styles from './FilterNav.module.css';

export type FilterNavItem = {
  value: string;
  label: string;
  href: string;
  /** Conteo informativo (estático, sin presión). */
  count?: number;
};

type Props = {
  /** Nombre accesible del grupo de filtros. */
  label: string;
  items: ReadonlyArray<FilterNavItem>;
  active: string;
  className?: string;
};

/**
 * Filtros por enlace (estado en la URL). En ≥ 641 px, chips que envuelven (sin scroll horizontal); en móvil,
 * una lista desplegable nativa con el filtro activo y su conteo. Navega con el router al elegir.
 */
export function FilterNav({ label, items, active, className }: Props) {
  const router = useRouter();
  const text = (item: FilterNavItem) =>
    item.count === undefined ? item.label : `${item.label} (${item.count})`;
  return (
    <div className={clsx(styles.root, className)}>
      <nav aria-label={label} className={styles.chips}>
        {items.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            className={clsx(styles.chip, item.value === active && styles.active)}
            aria-current={item.value === active ? 'page' : undefined}
          >
            {item.label}
            {item.count === undefined ? null : <span className={styles.count}>{item.count}</span>}
          </Link>
        ))}
      </nav>
      <div className={styles.select}>
        <label htmlFor={`filter-${label}`}>
          <VisuallyHidden>{label}</VisuallyHidden>
        </label>
        <Select
          id={`filter-${label}`}
          value={active}
          onChange={(event) => {
            const next = items.find((item) => item.value === event.target.value);
            if (next) router.push(next.href);
          }}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {text(item)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
