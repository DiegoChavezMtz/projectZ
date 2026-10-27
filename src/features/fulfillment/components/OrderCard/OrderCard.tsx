import Link from 'next/link';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import type { OrderView } from '../../types';
import { Countdown } from '../Countdown';
import { OrderStatusBadge } from '../StatusBadge';
import styles from './OrderCard.module.css';

const c = fulfillmentContent;

/** Tarjeta de una cuenta en la lista del comprador; lleva al detalle. */
export function OrderCard({ view }: { view: OrderView }) {
  const { order } = view;
  const total = order.total_cents ?? order.items_total_cents + order.shipping_cents;
  const awaiting = order.status === 'awaiting_payment' && order.pay_due_at;
  return (
    <Panel as="article" className={styles.root}>
      <div className={styles.head}>
        <Link href={`/orders/${order.id}`} className={styles.title}>
          {view.sessionTitle}
        </Link>
        <OrderStatusBadge status={order.status} />
      </div>
      <Text size="sm" tone="muted">
        {view.counterpart} · {c.common.items(view.items.length)} · {formatMXN(total)}
      </Text>
      {awaiting ? <Countdown dueAt={order.pay_due_at!} /> : null}
      <Link href={`/orders/${order.id}`} className={styles.link}>
        {c.buyer.openOrder}
      </Link>
    </Panel>
  );
}
