import type { ClaimItem, SessionStatus } from '@/types/claims';
import type { PendingAction, Viewer, ViewerEntry, CategoryView } from '../../types';
import { deriveItemView } from '../../utils/itemState';
import { ItemTile } from '../ItemTile';
import styles from './ItemGrid.module.css';

/** A partir de este número de artículos se difiere el pintado de las tarjetas fuera de pantalla. */
export const DEFER_THRESHOLD = 60;

type Props = {
  items: ClaimItem[];
  category: CategoryView;
  sessionStatus: SessionStatus;
  viewer: Viewer;
  isOwner: boolean;
  entries: ViewerEntry[];
  pending: Record<string, PendingAction>;
  onClaim: (item: ClaimItem) => void;
  onOffer: (item: ClaimItem) => void;
  onWithdraw: (entry: ViewerEntry) => void;
  /** Total real de artículos (sin filtrar), para decidir si se difiere el pintado. */
  total?: number;
};

export function ItemGrid({
  items,
  category,
  sessionStatus,
  viewer,
  isOwner,
  entries,
  pending,
  total = items.length,
  ...handlers
}: Props) {
  const interactive = sessionStatus === 'live' && !isOwner;
  return (
    <ul className={styles.root}>
      {items.map((item, index) => (
        <ItemTile
          key={item.id}
          item={item}
          category={category}
          interactive={interactive}
          deferred={total > DEFER_THRESHOLD}
          priority={index === 0}
          view={deriveItemView({
            item,
            sessionStatus,
            viewerId: viewer?.id ?? null,
            isOwner,
            entries,
            pending: pending[item.id],
          })}
          {...handlers}
        />
      ))}
    </ul>
  );
}
