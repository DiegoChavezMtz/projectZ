'use client';

import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';
import { liveClaimContent } from '../../content/es-MX';
import type { ItemFilter } from '../../types';
import styles from './ItemFilters.module.css';

const c = liveClaimContent.filters;

type Props = {
  filter: ItemFilter;
  query: string;
  /** Mostrar "Mis intentos" solo con sesión iniciada. */
  showMine: boolean;
  onFilter: (filter: ItemFilter) => void;
  onQuery: (query: string) => void;
};

export function ItemFilters({ filter, query, showMine, onFilter, onQuery }: Props) {
  const options: Array<{ value: ItemFilter; label: string }> = [
    { value: 'all', label: c.all },
    { value: 'available', label: c.available },
    ...(showMine ? [{ value: 'mine' as const, label: c.mine }] : []),
    { value: 'sold', label: c.sold },
  ];
  return (
    <div className={styles.root}>
      <div role="group" aria-label={c.label} className={styles.group}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.chip}
            aria-pressed={filter === option.value}
            onClick={() => onFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={styles.search}>
        <Label htmlFor="live-search">
          <VisuallyHidden>{c.searchLabel}</VisuallyHidden>
        </Label>
        <Input
          id="live-search"
          type="search"
          value={query}
          placeholder={c.searchPlaceholder}
          autoComplete="off"
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
    </div>
  );
}
