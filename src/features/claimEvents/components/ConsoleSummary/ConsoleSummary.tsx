import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { formatMXN } from '@/utils/money';
import { liveConsoleContent } from '../../content/es-MX';
import type { ConsoleSummary as Summary } from '../../types';
import styles from './ConsoleSummary.module.css';

const c = liveConsoleContent.summary;

type Props = { summary: Summary; noun: { plural: string } };

/** Resumen al terminar el evento: sale de `claim_wins`. "Cuentas" lleva a la bandeja de cumplimiento (S8). */
export function ConsoleSummary({ summary, noun }: Props) {
  return (
    <Panel className={styles.root}>
      <Heading level={2} size="lg">
        {c.heading}
      </Heading>
      <ul className={styles.stats}>
        <li>{c.sold(summary.soldCount, noun.plural)}</li>
        <li>{c.unsold(summary.unsoldCount, noun.plural)}</li>
        {summary.withdrawnCount > 0 ? <li>{c.withdrawn(summary.withdrawnCount)}</li> : null}
        <li>
          {c.revenue}: <strong>{formatMXN(summary.revenueCents)}</strong>
        </li>
      </ul>

      <Heading level={3} size="md">
        {c.buyersHeading}
      </Heading>
      {summary.buyers.length === 0 ? (
        <Text tone="muted">{c.noBuyers}</Text>
      ) : (
        <ul className={styles.buyers}>
          {summary.buyers.map((buyer) => (
            <li key={buyer.buyerId} className={styles.buyer}>
              <strong>{buyer.name || liveConsoleContent.items.unknownBuyer}</strong>
              <span>{c.buyerLine(buyer.winsCount, formatMXN(buyer.totalCents))}</span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button href="/dashboard/orders" variant="secondary">
          {c.accounts}
        </Button>
      </div>
    </Panel>
  );
}
