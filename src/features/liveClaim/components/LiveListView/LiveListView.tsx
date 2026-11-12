import { Suspense } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Panel } from '@/components/molecules/Panel';
import { ReputationBadge } from '@/components/molecules/ReputationBadge';
import { Skeleton } from '@/components/molecules/Skeleton';
import { Text } from '@/components/atoms/Text';
import { getCategory } from '@/types/categories';
import { formatDateTime } from '@/utils/dates';
import { liveClaimContent } from '../../content/es-MX';
import { liveListService } from '../../services/liveList.service';
import { sessionPath } from '../../utils/session';
import styles from './LiveListView.module.css';

const c = liveClaimContent.liveList;

/** `/live`: claims que están en vivo ahora (sin cuentas de prueba). La lista se transmite al cargar. */
export function LiveListView() {
  return (
    <Container className={styles.root}>
      <header className={styles.header}>
        <Heading level={1} size="xl">
          {c.title}
        </Heading>
        <Text tone="muted">{c.description}</Text>
      </header>
      <Suspense fallback={<Skeleton height="10rem" />}>
        <LiveList />
      </Suspense>
    </Container>
  );
}

async function LiveList() {
  const entries = await liveListService.list();
  return (
    <>
      {entries.length === 0 ? (
        <Panel className={styles.empty}>
          <Text>{c.empty}</Text>
          <Text tone="muted" size="sm">
            {c.emptyHint}
          </Text>
        </Panel>
      ) : (
        <ul className={styles.list}>
          {entries.map(({ session, seller, availableCount, totalCount }) => (
            <li key={session.id}>
              <Panel as="article" className={styles.card}>
                <Badge tone="success">{liveClaimContent.sessionStatus.live}</Badge>
                <Heading level={2} size="lg">
                  {session.title}
                </Heading>
                <Text size="sm" tone="muted">
                  {seller.shopName}
                  {seller.city ? ` · ${seller.city}` : ''}
                </Text>
                {seller.badge ? (
                  <ReputationBadge
                    compact
                    handle={seller.badge.handle}
                    name={seller.shopName}
                    winsCount={seller.badge.winsCount}
                    isSeller
                    rating={seller.badge.rating}
                    isNew={seller.badge.isNew}
                  />
                ) : null}
                <Text size="sm">
                  {c.available(
                    availableCount,
                    totalCount,
                    getCategory(session.category).itemLabels.plural,
                  )}
                </Text>
                {session.started_at ? (
                  <Text size="sm" tone="muted">
                    {c.since} {formatDateTime(session.started_at)}
                  </Text>
                ) : null}
                <Button href={sessionPath(session.code)}>{c.open}</Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
