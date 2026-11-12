import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { KpiTile } from '@/components/molecules/KpiTile';
import { Panel } from '@/components/molecules/Panel';
import { getCategory } from '@/types/categories';
import { formatDateTime } from '@/utils/dates';
import { claimEventsContent } from '../../content/es-MX';
import { claimSummaryService } from '../../services/claimSummary.service';
import { requireSellerId } from '../../services/seller.context';
import { StatusBadge } from '../StatusBadge';
import styles from './ClaimSummary.module.css';

const c = claimEventsContent.shopSummary;

/** Resumen de Mi tienda, parte de claims: el claim activo (o «Crear claim») y pendientes por dar el tuyo. */
export async function ClaimSummary() {
  const sellerId = await requireSellerId('/dashboard');
  const { active, pendingToConfirm } = await claimSummaryService.get(sellerId);

  if (!active) {
    return (
      <Panel className={styles.card}>
        <Heading level={2} size="lg">
          {c.noneTitle}
        </Heading>
        <Text tone="muted">{c.noneText}</Text>
        <div>
          <Button href="/dashboard/claims/new">{c.create}</Button>
        </div>
      </Panel>
    );
  }

  const live = active.status === 'live';
  const labels = getCategory(active.category).itemLabels;
  return (
    <>
      <Panel as="article" className={styles.card}>
        <div className={styles.head}>
          <Heading level={2} size="lg">
            {live ? c.activeTitle : c.nextTitle}
          </Heading>
          <StatusBadge status={active.status} />
        </div>
        <Heading level={3} size="md">
          {active.title}
        </Heading>
        <Text size="sm" tone="muted">
          {live && active.closes_at
            ? c.closes(formatDateTime(active.closes_at))
            : c.when(formatDateTime(active.starts_at))}{' '}
          · {claimEventsContent.list.itemCount(active.item_count, labels.singular, labels.plural)}
        </Text>
        <div className={styles.actions}>
          <Button
            href={
              live ? `/dashboard/claims/${active.id}/live` : `/dashboard/claims/${active.id}/edit`
            }
          >
            {live ? c.openConsole : c.openEvent}
          </Button>
          <Button href="/dashboard/claims" variant="secondary">
            {c.allClaims}
          </Button>
        </div>
      </Panel>
      {live ? (
        <KpiTile
          href={`/dashboard/claims/${active.id}/live`}
          value={pendingToConfirm}
          label={c.pendingToConfirm}
          color="pink"
        />
      ) : null}
    </>
  );
}
