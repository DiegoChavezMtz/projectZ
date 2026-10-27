'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import type { ClaimItem } from '@/types/claims';
import { liveClaimContent } from '../../content/es-MX';
import type {
  ItemFilter,
  LiveSnapshot,
  LiveState,
  Viewer,
  ViewerEntry,
  CategoryView,
} from '../../types';
import { filterItems } from '../../utils/filters';
import { ActivityFeed } from '../ActivityFeed';
import { ConnectionBanner } from '../ConnectionBanner';
import { Countdown } from '../Countdown';
import { EventHeader } from '../EventHeader';
import { HowItWorksPanel } from '../HowItWorksPanel';
import { ItemFilters } from '../ItemFilters';
import { ItemGrid } from '../ItemGrid';
import { OfferDialog } from '../OfferDialog';
import styles from './LiveView.module.css';

const c = liveClaimContent;
/** Mientras el cierre programado ya pasó pero el evento sigue `live`, se consulta con esta frecuencia. */
const CLOSE_POLL_MS = 15_000;

type Props = {
  state: LiveState;
  seller: LiveSnapshot['seller'];
  viewer: Viewer;
  isOwner: boolean;
  category: CategoryView;
  clock: { offsetMs: number; ready: boolean };
  refresh: () => Promise<void>;
  onClaim: (item: ClaimItem) => void;
  onOffer: (item: ClaimItem, amountCents: number) => Promise<void>;
  onWithdraw: (entry: ViewerEntry) => void;
};

export function LiveView({
  state,
  seller,
  viewer,
  isOwner,
  category,
  clock,
  refresh,
  onClaim,
  onOffer,
  onWithdraw,
}: Props) {
  const { session, items, entries, pending, feed, connection } = state;
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [query, setQuery] = useState('');
  const [offerItem, setOfferItem] = useState<ClaimItem | null>(null);
  const [closeReached, setCloseReached] = useState(false);

  const visible = useMemo(
    () => filterItems(items, { filter, query, entries }),
    [items, filter, query, entries],
  );

  useEffect(() => {
    if (!closeReached) return;
    const timer = setInterval(() => void refresh(), CLOSE_POLL_MS);
    return () => clearInterval(timer);
  }, [closeReached, refresh]);

  const filtering = filter !== 'all' || query.trim() !== '';

  return (
    <div className={styles.root}>
      <EventHeader session={session} seller={seller}>
        {session.closes_at ? (
          closeReached ? (
            <Text role="status">{c.countdown.closedSoon}</Text>
          ) : (
            <Countdown
              target={session.closes_at}
              offsetMs={clock.offsetMs}
              ready={clock.ready}
              label={c.countdown.closesIn}
              onReach={() => setCloseReached(true)}
            />
          )
        ) : null}
        {isOwner ? <Text tone="muted">{c.actions.ownEvent}</Text> : null}
      </EventHeader>

      <ConnectionBanner status={connection} />
      <HowItWorksPanel showGuardadito={session.allow_accumulate} />

      <div className={styles.layout}>
        <section className={styles.items} aria-labelledby="items-title">
          <h2 id="items-title" className={styles.heading}>
            {c.live.heading}
          </h2>
          <ItemFilters
            filter={filter}
            query={query}
            showMine={viewer !== null && !isOwner}
            onFilter={setFilter}
            onQuery={setQuery}
          />
          {visible.length === 0 ? (
            <div className={styles.empty}>
              <Text tone="muted">{filtering ? c.filters.empty : c.filters.emptyEvent}</Text>
              {filtering ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setQuery('');
                  }}
                >
                  {c.filters.clear}
                </Button>
              ) : null}
            </div>
          ) : (
            <ItemGrid
              items={visible}
              total={items.length}
              category={category}
              sessionStatus={session.status}
              viewer={viewer}
              isOwner={isOwner}
              entries={entries}
              pending={pending}
              onClaim={onClaim}
              onOffer={setOfferItem}
              onWithdraw={onWithdraw}
            />
          )}
        </section>

        <aside className={styles.feed} aria-labelledby="feed-title">
          <h2 id="feed-title" className={styles.heading}>
            {c.live.feedHeading}
          </h2>
          <ActivityFeed events={feed} noun={category.itemLabels} />
        </aside>
      </div>

      <OfferDialog item={offerItem} onClose={() => setOfferItem(null)} onSubmit={onOffer} />
    </div>
  );
}
