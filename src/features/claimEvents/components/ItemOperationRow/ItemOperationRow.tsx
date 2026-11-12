'use client';

import clsx from 'clsx';
import { memo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { publicEnv } from '@/lib/env.public';
import type { ClaimItem, SessionStatus } from '@/types/claims';
import type { CategoryDefinition } from '@/types/categories';
import { formatTime } from '@/utils/dates';
import { itemImageUrl } from '@/utils/image';
import { formatMXN } from '@/utils/money';
import { liveConsoleContent } from '../../content/es-MX';
import type { ConsoleEntry, ItemOperation, QueueRow } from '../../types';
import { ReputationBadge } from '@/components/molecules/ReputationBadge';
import { memberSinceLabel } from '../../utils/consoleOperations';
import { ConfirmDialog } from '../ConfirmDialog';
import styles from './ItemOperationRow.module.css';

const c = liveConsoleContent.items;
const a = liveConsoleContent.actions;

type StateKey = keyof typeof c.state;
const tones: Record<StateKey, 'neutral' | 'success' | 'accent' | 'info'> = {
  hidden: 'neutral',
  available: 'success',
  claimed: 'accent',
  offers: 'info',
  sold: 'neutral',
  withdrawn: 'neutral',
};

export function operationState(item: ClaimItem): StateKey {
  if (item.status === 'available') {
    if (item.leader_entry_id) return 'claimed';
    return item.offer_count > 0 ? 'offers' : 'available';
  }
  return item.status;
}

export type RowHandlers = {
  onRelease: (item: ClaimItem) => void;
  onWithdraw: (item: ClaimItem) => void;
  onFeature: (item: ClaimItem, featured: boolean) => void;
  onConfirm: (entry: ConsoleEntry) => void;
  onReject: (entry: ConsoleEntry) => void;
  onAcceptOffer: (entry: ConsoleEntry) => void;
  onRejectOffer: (entry: ConsoleEntry) => void;
};

type Props = {
  operation: ItemOperation;
  category: Pick<CategoryDefinition, 'imageAspect'>;
  sessionStatus: SessionStatus;
  autoConfirm: boolean;
  manualRelease: boolean;
  /** Claves con una acción en curso (`item:<id>`, `entry:<id>`). */
  busy: Record<string, true>;
  handlers: RowHandlers;
};

function BuyerLine({ row, wins }: { row: QueueRow; wins?: number | null }) {
  const name = row.buyerName || c.unknownBuyer;
  if (row.badge) {
    return (
      <span className={styles.buyer}>
        <strong>{name}</strong>{' '}
        <ReputationBadge
          compact
          handle={row.badge.handle}
          name={name}
          winsCount={row.badge.winsCount}
          isSeller={false}
          rating={row.badge.rating}
          paidOnTimeRate={row.badge.paidOnTimeRate}
          isNew={row.badge.isNew}
        />
      </span>
    );
  }
  const since = memberSinceLabel(row.memberSince);
  return (
    <span className={styles.buyer}>
      <strong>{name}</strong>
      {wins !== undefined ? <span> · {wins ? c.wins(wins) : c.newBuyer}</span> : null}
      {since ? <span> · {c.member(since)}</span> : null}
    </span>
  );
}

/** Un artículo con su fila de claims, ofertas y acciones. Botones de al menos 44 px para usarse con el pulgar. */
function ItemOperationRowBase({
  operation,
  category,
  sessionStatus,
  autoConfirm,
  manualRelease,
  busy,
  handlers,
}: Props) {
  const { item, queue, offers, winner } = operation;
  const [pending, setPending] = useState<
    { kind: 'withdraw' } | { kind: 'reject'; row: QueueRow } | null
  >(null);
  const live = sessionStatus === 'live';
  const state = operationState(item);
  const itemBusy = Boolean(busy[`item:${item.id}`]);
  const leader = queue.find((row) => row.isLeader) ?? null;
  const closed = item.status === 'sold' || item.status === 'withdrawn';

  return (
    <li
      id={`item-${item.id}`}
      className={clsx(styles.root, closed && styles.done, item.is_featured && styles.featured)}
      data-state={state}
    >
      <div className={styles.head}>
        <Picture
          className={styles.thumb}
          aspect={category.imageAspect}
          src={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path)}
          alt={item.title}
        />
        <div className={styles.info}>
          <Text className={styles.title}>{item.title}</Text>
          <span className={styles.price}>{formatMXN(item.price_cents)}</span>
          <div className={styles.badges}>
            <Badge tone={tones[state]}>{c.state[state]}</Badge>
            {item.is_featured ? <Badge tone="accent">{c.featured}</Badge> : null}
          </div>
        </div>
      </div>

      {item.status === 'sold' && winner ? (
        <Text size="sm" tone="muted">
          {c.soldTo(winner.buyerName || c.unknownBuyer, formatMXN(winner.entry.amount_cents))}
        </Text>
      ) : null}

      {item.status === 'available' ? (
        <div className={styles.lists}>
          <section aria-label={c.queueHeading}>
            <h3 className={styles.sub}>{c.queueHeading}</h3>
            {queue.length === 0 ? (
              <Text size="sm" tone="muted">
                {c.noQueue}
              </Text>
            ) : (
              <ol className={styles.rows}>
                {queue.map((row) => {
                  const rowBusy = Boolean(busy[`entry:${row.entry.id}`]);
                  return (
                    <li key={row.entry.id} className={styles.entry}>
                      <div>
                        <BuyerLine
                          row={row}
                          wins={row.isLeader ? (item.leader_wins_count ?? 0) : undefined}
                        />
                        <Text size="sm" tone="muted">
                          {row.isLeader ? `${c.leader} · ` : ''}
                          {c.at(formatTime(row.entry.created_at))}
                        </Text>
                      </div>
                      {live && row.isLeader ? (
                        <div className={styles.buttons}>
                          {!autoConfirm ? (
                            <Button
                              size="sm"
                              loading={rowBusy}
                              onClick={() => handlers.onConfirm(row.entry)}
                            >
                              {a.confirm}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={rowBusy}
                            onClick={() => setPending({ kind: 'reject', row })}
                          >
                            {a.reject}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {offers.length > 0 ? (
            <section aria-label={c.offersHeading}>
              <h3 className={styles.sub}>{c.offersHeading}</h3>
              <ul className={styles.rows}>
                {offers.map((row) => {
                  const rowBusy = Boolean(busy[`entry:${row.entry.id}`]);
                  return (
                    <li key={row.entry.id} className={styles.entry}>
                      <div>
                        <BuyerLine row={row} />
                        <Text size="sm" tone="accent">
                          {c.offerAmount(
                            formatMXN(row.entry.amount_cents),
                            formatMXN(item.price_cents),
                          )}{' '}
                          · {c.at(formatTime(row.entry.created_at))}
                        </Text>
                      </div>
                      {live ? (
                        <div className={styles.buttons}>
                          <Button
                            size="sm"
                            loading={rowBusy}
                            onClick={() => handlers.onAcceptOffer(row.entry)}
                          >
                            {a.acceptOffer}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={rowBusy}
                            onClick={() => handlers.onRejectOffer(row.entry)}
                          >
                            {a.rejectOffer}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {live && !closed ? (
        <div className={styles.buttons}>
          {item.status === 'hidden' && manualRelease ? (
            <Button size="sm" loading={itemBusy} onClick={() => handlers.onRelease(item)}>
              {a.release}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={itemBusy}
            onClick={() => handlers.onFeature(item, !item.is_featured)}
          >
            {item.is_featured ? a.unfeature : a.feature}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={itemBusy}
            onClick={() => setPending({ kind: 'withdraw' })}
          >
            {a.withdraw}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={pending?.kind === 'withdraw'}
        title={a.confirmWithdrawTitle}
        text={a.confirmWithdrawText}
        onConfirm={() => handlers.onWithdraw(item)}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'reject'}
        title={
          pending?.kind === 'reject' ? a.confirmReject(pending.row.buyerName || c.unknownBuyer) : ''
        }
        text={leader ? `«${item.title}»` : ''}
        confirmLabel={a.reject}
        onConfirm={() => pending?.kind === 'reject' && handlers.onReject(pending.row.entry)}
        onClose={() => setPending(null)}
      />
    </li>
  );
}

export const ItemOperationRow = memo(ItemOperationRowBase);
