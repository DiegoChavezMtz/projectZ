'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { ToastProvider } from '@/context/ToastContext';
import type { CategoryDefinition } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { liveConsoleContent } from '../../content/es-MX';
import { useConsoleActions } from '../../hooks/useConsoleActions';
import { useSellerLiveClaim } from '../../hooks/useSellerLiveClaim';
import type { ConsoleSnapshot } from '../../types';
import {
  buildOperations,
  buildSummary,
  countHidden,
  nextHiddenItem,
} from '../../utils/consoleOperations';
import { AnnouncementForm } from '../AnnouncementForm';
import { ConsoleFeed } from '../ConsoleFeed';
import { ConsoleHeader } from '../ConsoleHeader';
import { ConsoleSummary } from '../ConsoleSummary';
import { ItemOperationRow, type RowHandlers } from '../ItemOperationRow';
import { ReleasePanel } from '../ReleasePanel';
import styles from './LiveConsoleView.module.css';

const c = liveConsoleContent;

type Props = {
  snapshot: ConsoleSnapshot;
  category: Pick<CategoryDefinition, 'imageAspect' | 'itemLabels'>;
};

export function LiveConsoleView(props: Props) {
  return (
    <ToastProvider>
      <LiveConsoleScreen {...props} />
    </ToastProvider>
  );
}

function LiveConsoleScreen({ snapshot, category }: Props) {
  const { state, dispatch, wins, refresh } = useSellerLiveClaim(snapshot);
  const actions = useConsoleActions({ connection: state.connection, dispatch, refresh });
  const [tab, setTab] = useState<'items' | 'activity'>('items');

  // Hora del servidor aproximada (desfase medido al cargar), para validar el cierre en el cliente.
  const offsetMs = useRef(0);
  useEffect(() => {
    offsetMs.current = Date.parse(snapshot.serverNow) - Date.now();
  }, [snapshot.serverNow]);
  const now = useCallback(() => Date.now() + offsetMs.current, []);

  const { session, items, entries, buyers, busy } = state;
  const operations = useMemo(
    () => buildOperations(items, entries, buyers),
    [items, entries, buyers],
  );
  const summary = useMemo(() => buildSummary(items, wins, buyers), [items, wins, buyers]);
  const noun = category.itemLabels;
  const live = session.status === 'live';
  const manual = session.release_mode === 'manual';
  const hiddenCount = countHidden(items);

  const handlers: RowHandlers = useMemo(
    () => ({
      onRelease: (item: ClaimItem) => void actions.releaseItem(item.id),
      onWithdraw: (item) => void actions.withdrawItem(item.id),
      onFeature: (item, featured) => void actions.featureItem(item.id, featured),
      onConfirm: (entry) => void actions.confirm(entry),
      onReject: (entry) => void actions.reject(entry),
      onAcceptOffer: (entry) => void actions.acceptOffer(entry),
      onRejectOffer: (entry) => void actions.rejectOffer(entry),
    }),
    [actions],
  );

  return (
    <Container className={styles.root}>
      {state.connection === 'reconnecting' || state.connection === 'offline' ? (
        <div role="status" className={styles.banner} data-status={state.connection}>
          {state.connection === 'offline' ? c.connection.offline : c.connection.reconnecting}
        </div>
      ) : (
        <div role="status" />
      )}

      <ConsoleHeader
        session={session}
        itemCount={items.length}
        nounPlural={noun.plural}
        busy={Boolean(busy.session)}
        now={now}
        onStart={() => void actions.start(session.id)}
        onEnd={() => void actions.end(session.id)}
        onExtend={(iso) => void actions.extendClose(session.id, iso)}
      />

      {session.status === 'ended' ? <ConsoleSummary summary={summary} noun={noun} /> : null}

      <div className={styles.tabs} role="tablist" aria-label={c.tabs.label}>
        {(['items', 'activity'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`console-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`console-pane-${value}`}
            className={clsx(styles.tab, tab === value && styles.active)}
            onClick={() => setTab(value)}
          >
            {c.tabs[value]}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <section
          id="console-pane-items"
          role="tabpanel"
          aria-labelledby="console-tab-items"
          className={clsx(styles.pane, tab !== 'items' && styles.hiddenOnMobile)}
        >
          <Heading level={2} size="lg">
            {c.items.heading}
          </Heading>
          {live && manual ? (
            <ReleasePanel
              hiddenCount={hiddenCount}
              next={nextHiddenItem(items)}
              noun={noun}
              busy={Boolean(busy.session)}
              onReleaseNext={handlers.onRelease}
              onReleaseAll={() => void actions.releaseAll(session.id)}
            />
          ) : null}
          {operations.length === 0 ? (
            <Text tone="muted">{c.items.empty}</Text>
          ) : (
            <ul className={styles.list}>
              {operations.map((operation) => (
                <ItemOperationRow
                  key={operation.item.id}
                  operation={operation}
                  category={category}
                  sessionStatus={session.status}
                  autoConfirm={session.auto_confirm}
                  manualRelease={manual}
                  busy={busy}
                  handlers={handlers}
                />
              ))}
            </ul>
          )}
        </section>

        <aside
          id="console-pane-activity"
          role="tabpanel"
          aria-labelledby="console-tab-activity"
          className={clsx(styles.pane, styles.side, tab !== 'activity' && styles.hiddenOnMobile)}
        >
          <Heading level={2} size="lg">
            {c.announce.heading}
          </Heading>
          <AnnouncementForm
            enabled={live}
            busy={Boolean(busy.announce)}
            onSubmit={async (text) => (await actions.announce(session.id, text)) === true}
          />
          <Heading level={2} size="lg">
            {c.feed.heading}
          </Heading>
          <ConsoleFeed events={state.feed} noun={noun} />
        </aside>
      </div>
    </Container>
  );
}
