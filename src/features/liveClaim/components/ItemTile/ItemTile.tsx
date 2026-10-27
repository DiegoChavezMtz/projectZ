import { memo } from 'react';
import clsx from 'clsx';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { publicEnv } from '@/lib/env.public';
import type { ClaimItem } from '@/types/claims';
import { itemImageUrl } from '@/utils/image';
import { formatMXN } from '@/utils/money';
import { liveClaimContent } from '../../content/es-MX';
import type { ItemView, PublicItemState, ViewerEntry, CategoryView } from '../../types';
import styles from './ItemTile.module.css';

const c = liveClaimContent;

const stateTone: Record<PublicItemState, 'neutral' | 'success' | 'accent' | 'info'> = {
  upcoming: 'neutral',
  available: 'success',
  claimed: 'accent',
  offers: 'info',
  sold: 'neutral',
  withdrawn: 'neutral',
};

type Props = {
  item: ClaimItem;
  view: ItemView;
  category: CategoryView;
  /** Muestra botones de acción (el evento está en vivo y el espectador no es el vendedor). */
  interactive: boolean;
  deferred?: boolean;
  priority?: boolean;
  onClaim: (item: ClaimItem) => void;
  onOffer: (item: ClaimItem) => void;
  onWithdraw: (entry: ViewerEntry) => void;
};

function attributeBadges(item: ClaimItem, category: CategoryView) {
  const attributes = (item.attributes ?? {}) as Record<string, unknown>;
  const badges: string[] = [];
  const details: string[] = [];
  for (const field of category.fields) {
    const value = attributes[field.name];
    if (typeof value !== 'string' || !value) continue;
    if (field.kind === 'select') {
      const label = field.options.find((option) => option.value === value)?.label ?? value;
      badges.push(label);
    } else {
      details.push(value);
    }
  }
  return { badges, details };
}

function ItemTileBase({
  item,
  view,
  category,
  interactive,
  deferred,
  priority,
  onClaim,
  onOffer,
  onWithdraw,
}: Props) {
  const { badges, details } = attributeBadges(item, category);
  const price = formatMXN(item.price_cents);
  const stateLabel = c.states[view.state];
  const relationLabel = view.relation === 'none' ? null : c.relations[view.relation];
  const done = view.state === 'sold' || view.state === 'withdrawn';
  const leaderName = item.leader_display_name ?? item.leader_handle;

  return (
    <li
      id={`item-${item.id}`}
      className={clsx(
        styles.root,
        deferred && styles.deferred,
        done && styles.done,
        view.relation === 'won' && styles.mine,
        (view.relation === 'leading' || view.relation === 'queued' || view.relation === 'offered') &&
          styles.involved,
      )}
      aria-label={c.item.tileLabel(item.title, stateLabel, price)}
    >
      <div className={styles.media}>
        <Picture
          aspect={category.imageAspect}
          src={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path)}
          alt={item.title}
          placeholder={c.item.missingImage}
          priority={priority}
        />
        <Badge tone={stateTone[view.state]} className={styles.state}>
          {stateLabel}
        </Badge>
        {item.is_featured ? (
          <Badge tone="accent" className={styles.featured}>
            {c.item.featured}
          </Badge>
        ) : null}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{item.title}</h3>
        {details.length > 0 ? (
          <Text size="sm" tone="muted">
            {details.join(' · ')}
          </Text>
        ) : null}
        {badges.length > 0 ? (
          <div className={styles.badges}>
            {badges.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
          </div>
        ) : null}
        <p className={styles.price}>{price}</p>

        {leaderName && (view.state === 'claimed' || view.state === 'sold') ? (
          <Text size="sm" tone="muted" className={styles.leader}>
            {c.leader.by(leaderName)}
            {item.leader_wins_count != null && item.leader_wins_count > 0
              ? ` · ${c.leader.wins(item.leader_wins_count)}`
              : ''}
          </Text>
        ) : null}

        <div role="status" className={styles.relation}>
          {relationLabel ? (
            <Text size="sm" tone="accent">
              {c.item.announce(item.title, relationLabel)}
            </Text>
          ) : null}
        </div>

        {interactive ? (
          <div className={styles.actions}>
            {view.canClaim ? (
              <Button size="md" fullWidth onClick={() => onClaim(item)}>
                {c.actions.claim}
              </Button>
            ) : null}
            {view.canOffer ? (
              <Button size="md" variant="secondary" fullWidth onClick={() => onOffer(item)}>
                {c.actions.offer}
              </Button>
            ) : null}
            {view.openEntry ? (
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                onClick={() => view.openEntry && onWithdraw(view.openEntry)}
              >
                {view.openEntry.kind === 'offer' ? c.actions.withdrawOffer : c.actions.withdrawClaim}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

const sameView = (a: ItemView, b: ItemView) =>
  a.state === b.state &&
  a.relation === b.relation &&
  a.canClaim === b.canClaim &&
  a.canOffer === b.canOffer &&
  a.openEntry?.id === b.openEntry?.id &&
  a.openEntry?.status === b.openEntry?.status;

/** Memoizada: un evento del feed o de otro artículo no vuelve a pintar esta tarjeta. */
export const ItemTile = memo(
  ItemTileBase,
  (prev, next) =>
    prev.item === next.item &&
    prev.category === next.category &&
    prev.interactive === next.interactive &&
    prev.deferred === next.deferred &&
    prev.priority === next.priority &&
    prev.onClaim === next.onClaim &&
    prev.onOffer === next.onOffer &&
    prev.onWithdraw === next.onWithdraw &&
    sameView(prev.view, next.view),
);
