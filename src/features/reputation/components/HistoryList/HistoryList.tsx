import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { formatDate } from '@/utils/dates';
import { reputationContent } from '../../content/es-MX';
import type { HistoryPage, RepRole } from '../../types';
import { formatHistoryEntry, type HistoryTone } from '../../utils/reputation.utils';
import styles from './HistoryList.module.css';

const c = reputationContent.page;
const toneToBadge = { positive: 'success', negative: 'danger', neutral: 'neutral' } as const;

type Props = {
  handle: string;
  history: HistoryPage;
  role?: RepRole;
};

const href = (handle: string, role: RepRole | undefined, page: number) => {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/u/${encodeURIComponent(handle)}${query ? `?${query}` : ''}`;
};

const filters: { value: RepRole | undefined; label: string }[] = [
  { value: undefined, label: c.filterAll },
  { value: 'buyer', label: c.filterBuyer },
  { value: 'seller', label: c.filterSeller },
];

/** Historial público paginado con filtro por rol. Cada entrada enlaza a su claim. */
export function HistoryList({ handle, history, role }: Props) {
  return (
    <section aria-labelledby="history-title" className={styles.root}>
      <Heading level={2} size="lg" id="history-title">
        {c.historyTitle}
      </Heading>
      <nav aria-label={c.filterLabel} className={styles.filters}>
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={href(handle, filter.value, 1)}
            className={styles.filter}
            aria-current={filter.value === role ? 'page' : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {history.entries.length === 0 ? (
        <Text tone="muted">{c.noHistory}</Text>
      ) : (
        <ul className={styles.list}>
          {history.entries.map((entry) => {
            const line = formatHistoryEntry(entry);
            const tone: HistoryTone = line.tone;
            return (
              <li key={entry.id} className={styles.entry}>
                <div className={styles.head}>
                  <Badge tone={toneToBadge[tone]}>{line.title}</Badge>
                  {line.disputed ? (
                    <Badge tone="warning">{reputationContent.disputed}</Badge>
                  ) : null}
                  <time className={styles.date} dateTime={entry.occurredAt}>
                    {formatDate(entry.occurredAt)}
                  </time>
                </div>
                <Text size="sm" tone="muted">
                  {entry.sessionCode && entry.sessionTitle ? (
                    <Link href={`/c/${entry.sessionCode}`} className={styles.link}>
                      {entry.sessionTitle}
                    </Link>
                  ) : null}
                  {entry.counterpartyName
                    ? ` · ${reputationContent.history.withCounterparty(entry.counterpartyName)}`
                    : ''}
                </Text>
                {line.tagLabels.length > 0 ? (
                  <Text size="sm" tone="muted">
                    {line.tagLabels.join(' · ')}
                  </Text>
                ) : null}
                {entry.comment ? <Text size="sm">«{entry.comment}»</Text> : null}
                {entry.disputeNote ? (
                  <Text size="sm" tone="muted">
                    {reputationContent.disputeNote(entry.disputeNote)}
                  </Text>
                ) : null}
                {entry.disputeResolutionNote ? (
                  <Text size="sm" tone="muted">
                    {reputationContent.disputeResolution(entry.disputeResolutionNote)}
                  </Text>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {history.page > 1 || history.hasMore ? (
        <nav aria-label={c.historyNav} className={styles.pager}>
          {history.page > 1 ? (
            <Link className={styles.link} href={href(handle, role, history.page - 1)}>
              {c.newer}
            </Link>
          ) : null}
          {history.hasMore ? (
            <Link className={styles.link} href={href(handle, role, history.page + 1)}>
              {c.older}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
