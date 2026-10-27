'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { Container } from '@/components/atoms/Container';
import { Text } from '@/components/atoms/Text';
import { ToastProvider } from '@/context/ToastContext';
import type { ClaimItem } from '@/types/claims';
import { liveClaimContent } from '../../content/es-MX';
import { useClaimActions } from '../../hooks/useClaimActions';
import { useLiveClaim } from '../../hooks/useLiveClaim';
import { useServerClock } from '../../hooks/useServerClock';
import type { CategoryView, LiveSnapshot, Viewer, ViewerEntry } from '../../types';
import { EndedView } from '../EndedView';
import { LiveView } from '../LiveView';
import { ScheduledView } from '../ScheduledView';
import styles from './LiveClaimView.module.css';

type Props = {
  snapshot: LiveSnapshot;
  viewer: Viewer;
  isOwner: boolean;
  category: CategoryView;
  /** Intentos propios con los que renderizó el servidor. */
  initialEntries: ViewerEntry[];
  /** URL absoluta del evento (calendario). */
  eventUrl: string;
};

export function LiveClaimView(props: Props) {
  return (
    <ToastProvider>
      <LiveClaimScreen {...props} />
    </ToastProvider>
  );
}

function LiveClaimScreen({ snapshot, viewer, isOwner, category, initialEntries, eventUrl }: Props) {
  const { state, dispatch, refresh, refreshEntries } = useLiveClaim(snapshot, viewer, initialEntries);
  const clock = useServerClock(snapshot.serverNow);
  const code = state.session.code;
  const router = useRouter();

  // Visitante sin sesión: se lleva a iniciar sesión y regresa al artículo (ancla).
  const requireLogin = useCallback(
    (itemId: string) => {
      router.push(`/login?next=${encodeURIComponent(`/c/${code}#item-${itemId}`)}`);
    },
    [code, router],
  );

  const actions = useClaimActions({
    connection: state.connection,
    dispatch,
    refresh,
    refreshEntries,
    requireLogin,
  });

  const { claim, offer, withdraw } = actions;
  const onClaim = useCallback(
    (item: ClaimItem) => (viewer ? void claim(item) : requireLogin(item.id)),
    [viewer, claim, requireLogin],
  );
  const onOffer = useCallback(
    async (item: ClaimItem, amountCents: number) => {
      if (!viewer) return requireLogin(item.id);
      await offer(item, amountCents);
    },
    [viewer, offer, requireLogin],
  );
  const onWithdraw = useCallback((entry: ViewerEntry) => void withdraw(entry), [withdraw]);

  const { status } = state.session;

  return (
    <Container className={styles.root}>
      {status === 'live' ? (
        <LiveView
          state={state}
          seller={snapshot.seller}
          viewer={viewer}
          isOwner={isOwner}
          category={category}
          clock={clock}
          refresh={refresh}
          onClaim={onClaim}
          onOffer={onOffer}
          onWithdraw={onWithdraw}
        />
      ) : status === 'ended' ? (
        <EndedView
          session={state.session}
          seller={snapshot.seller}
          items={state.items}
          category={category}
        />
      ) : status === 'cancelled' ? (
        <Text>{liveClaimContent.meta.notFoundTitle}</Text>
      ) : (
        <ScheduledView
          state={state}
          seller={snapshot.seller}
          viewer={viewer}
          isOwner={isOwner}
          category={category}
          eventUrl={eventUrl}
          clock={clock}
        />
      )}
    </Container>
  );
}
