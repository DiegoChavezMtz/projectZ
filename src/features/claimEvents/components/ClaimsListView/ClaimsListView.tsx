import clsx from 'clsx';
import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { getCategory } from '@/types/categories';
import { formatDateTime } from '@/utils/dates';
import { claimEventsContent } from '../../content/es-MX';
import { LIST_LIMIT, claimSessionService } from '../../services/claimSession.service';
import { requireSellerId } from '../../services/seller.context';
import type { SessionListFilter } from '../../types';
import { isSessionEditable } from '../../utils/session.utils';
import { StatusBadge } from '../StatusBadge';
import styles from './ClaimsListView.module.css';

const c = claimEventsContent.list;

const FILTERS: SessionListFilter[] = ['all', 'draft', 'scheduled', 'live', 'ended', 'cancelled'];

export const parseListFilter = (value: string | undefined): SessionListFilter =>
  FILTERS.includes(value as SessionListFilter) ? (value as SessionListFilter) : 'all';

/** S4-08: lista SSR de eventos del vendedor con tabs por estado. */
export async function ClaimsListView({ status }: { status?: string }) {
  const filter = parseListFilter(status);
  const sellerId = await requireSellerId('/dashboard/claims');
  const sessions = await claimSessionService.list(sellerId, filter);

  return (
    <Container className={styles.root}>
      <header className={styles.header}>
        <div>
          <Heading level={1} size="xl">
            {c.title}
          </Heading>
          <Text tone="muted">{c.subtitle}</Text>
        </div>
        <Button href="/dashboard/claims/new">{c.newEvent}</Button>
      </header>

      <nav aria-label={c.tabsLabel} className={styles.tabs}>
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={value === 'all' ? '/dashboard/claims' : `/dashboard/claims?status=${value}`}
            className={clsx(styles.tab, value === filter && styles.active)}
            aria-current={value === filter ? 'page' : undefined}
          >
            {value === 'all' ? c.tabAll : claimEventsContent.status[value]}
          </Link>
        ))}
      </nav>

      {sessions.length === 0 ? (
        <Panel className={styles.empty}>
          <Heading level={2} size="lg">
            {filter === 'all' ? c.emptyTitle : c.emptyFiltered}
          </Heading>
          {filter === 'all' ? <Text tone="muted">{c.emptyText}</Text> : null}
          {filter === 'all' ? <Button href="/dashboard/claims/new">{c.newEvent}</Button> : null}
        </Panel>
      ) : (
        <ul className={styles.list}>
          {sessions.map((session) => {
            const labels = getCategory(session.category).itemLabels;
            return (
              <li key={session.id}>
                <Panel as="article" className={styles.card}>
                  <div className={styles.cardHead}>
                    <Heading level={2} size="md">
                      {session.title}
                    </Heading>
                    <StatusBadge status={session.status} />
                  </div>
                  <Text size="sm" tone="muted">
                    {formatDateTime(session.starts_at)} ·{' '}
                    {c.itemCount(session.item_count, labels.singular, labels.plural)}
                  </Text>
                  <div className={styles.actions}>
                    {isSessionEditable(session.status) ? (
                      <Button href={`/dashboard/claims/${session.id}/edit`} size="sm">
                        {c.edit}
                      </Button>
                    ) : null}
                    {session.status !== 'cancelled' ? (
                      <Button
                        href={`/dashboard/claims/${session.id}/preview`}
                        size="sm"
                        variant="secondary"
                      >
                        {c.preview}
                      </Button>
                    ) : null}
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
      {sessions.length >= LIST_LIMIT ? (
        <Text size="sm" tone="muted">
          {c.limitNote(LIST_LIMIT)}
        </Text>
      ) : null}
    </Container>
  );
}
