import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { reputationContent } from '../../content/es-MX';
import type { RepRole, ReputationStats } from '../../types';
import {
  closedOnTimeRate,
  deliveryOnTimeRate,
  formatPercent,
  paidOnTimeRate,
} from '../../utils/reputation.utils';
import styles from './StatsBlock.module.css';

const c = reputationContent.page;

type Row = { label: string; value: string };

function rateRow(label: string, rate: number | null): Row {
  return {
    label,
    value: rate === null ? reputationContent.insufficientHistory : `${formatPercent(rate)} %`,
  };
}

function rows(role: RepRole, stats: ReputationStats): Row[] {
  if (role === 'buyer') {
    return [
      { label: c.stats.winsCount, value: String(stats.winsCount) },
      { label: c.stats.sessionsParticipated, value: String(stats.sessionsParticipated) },
      rateRow(c.stats.paidOnTime, paidOnTimeRate(stats)),
      { label: c.stats.deliveriesReceived, value: String(stats.deliveriesReceived) },
      { label: c.stats.ordersReleased, value: String(stats.ordersReleased) },
    ];
  }
  return [
    { label: c.stats.sessionsHosted, value: String(stats.sessionsHosted) },
    { label: c.stats.winsSold, value: String(stats.winsSold) },
    rateRow(c.stats.closedOnTime, closedOnTimeRate(stats)),
    rateRow(c.stats.deliveryOnTime, deliveryOnTimeRate(stats)),
  ];
}

/** Estadísticas de un rol (comprador o vendedor). */
export function StatsBlock({ role, stats }: { role: RepRole; stats: ReputationStats }) {
  const id = `stats-${role}`;
  return (
    <Panel as="section" aria-labelledby={id}>
      <Heading level={2} size="md" id={id}>
        {role === 'buyer' ? c.buyerStats : c.sellerStats}
      </Heading>
      <dl className={styles.list}>
        {rows(role, stats).map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>
              <Text as="span" size="sm" tone="muted">
                {row.label}
              </Text>
            </dt>
            <dd className={styles.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
