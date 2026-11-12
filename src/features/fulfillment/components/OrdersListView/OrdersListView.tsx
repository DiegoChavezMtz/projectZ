import { connection } from 'next/server';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { orderQueries } from '../../services/orderQueries';
import { requireUser } from '../../services/session.context';
import type { DeliveryView, OrderView } from '../../types';
import { groupAccumulableOrders } from '../../utils/accumulate';
import { buyerSection, toOrderTiming } from '../../utils/orderTiming';
import { ConfirmReceiptButton } from '../BuyerActions';
import { Countdown } from '../Countdown';
import { OrderCard } from '../OrderCard';
import { RequestDeliveryForm } from '../RequestDeliveryForm';
import { DeliveryStatusBadge } from '../StatusBadge';
import { ToastProvider } from '@/context/ToastContext';
import { CounterpartBadge } from '../CounterpartBadge';
import styles from './OrdersListView.module.css';

const c = fulfillmentContent;

function DeliveryCard({ view }: { view: DeliveryView }) {
  const { delivery } = view;
  const first = view.orders[0];
  return (
    <Panel as="article" className={styles.card}>
      <div className={styles.cardHead}>
        <Heading level={3} size="md">
          {view.counterpart}
        </Heading>
        <DeliveryStatusBadge status={delivery.status} />
      </div>
      <Text size="sm" tone="muted">
        {c.method[delivery.method]} · {view.orders.map((o) => o.sessionTitle).join(', ')}
      </Text>
      <CounterpartBadge badge={view.counterpartBadge} name={view.counterpart} />
      {delivery.status === 'awaiting_payment' && delivery.pay_due_at ? (
        <>
          <Text size="sm">
            {c.seller.delivery.quote.title}: {formatMXN(delivery.shipping_cents)}
          </Text>
          <Countdown dueAt={delivery.pay_due_at} />
        </>
      ) : null}
      {delivery.tracking_code ? (
        <Text size="sm">{c.buyer.detail.trackingCode(delivery.tracking_code)}</Text>
      ) : null}
      {first ? (
        <a className={styles.link} href={`/orders/${first.order.id}`}>
          {c.buyer.openOrder}
        </a>
      ) : null}
      {delivery.status === 'shipped' ? <ConfirmReceiptButton deliveryId={delivery.id} /> : null}
    </Panel>
  );
}

export type BuyerView = 'pending' | 'history';

/**
 * Cuentas del comprador (SSR), en dos pantallas: `/orders` «Por pagar y enviar» (lo ganado sin pagar:
 * comprobante, seguimiento de envío y guardadito) y `/orders/history` «Historial» (cerrados y entregados).
 */
export async function OrdersListView({ view = 'pending' }: { view?: BuyerView }) {
  // Las comparaciones con la hora actual se resuelven en cada petición, no al prerenderizar.
  await connection();
  const { supabase, userId } = await requireUser(
    view === 'history' ? '/orders/history' : '/orders',
  );
  const { orders, deliveries } = await orderQueries.forBuyer(supabase, userId);
  const b = c.buyer;

  const bySection = (section: ReturnType<typeof buyerSection>) =>
    orders.filter((view) => buyerSection(view.order) === section);
  const toPay = bySection('toPay');
  const history = bySection('history');
  const accumulateGroups = groupAccumulableOrders(
    bySection('accumulate').map((view) => ({ ...toOrderTiming(view.order), view })),
  );
  const activeDeliveries = deliveries.filter(
    (d) => !['delivered', 'cancelled'].includes(d.delivery.status),
  );
  const doneDeliveries = deliveries.filter((d) => d.delivery.status === 'delivered');
  const showPending = view === 'pending';
  const hasPending = toPay.length + accumulateGroups.length + activeDeliveries.length > 0;
  const hasHistory = history.length + doneDeliveries.length > 0;
  const empty = showPending ? !hasPending : !hasHistory;

  const list = (items: OrderView[]) => (
    <ul className={styles.list}>
      {items.map((view) => (
        <li key={view.order.id}>
          <OrderCard view={view} />
        </li>
      ))}
    </ul>
  );

  return (
    <ToastProvider>
      <Container className={styles.root}>
        <header>
          <Heading level={1} size="xl">
            {showPending ? b.title : b.historyTitle}
          </Heading>
          <Text tone="muted" className={styles.subtitle}>
            {showPending ? b.subtitle : b.historySubtitle}
          </Text>
        </header>

        {empty ? (
          <Panel className={styles.empty}>
            <Heading level={2} size="lg">
              {showPending ? b.emptyPending : b.emptyHistory}
            </Heading>
            {showPending ? <Text tone="muted">{b.emptyText}</Text> : null}
          </Panel>
        ) : null}

        {showPending && toPay.length > 0 ? (
          <section className={styles.section} aria-labelledby="orders-to-pay">
            <Heading level={2} size="lg" id="orders-to-pay">
              {b.sections.toPay}
            </Heading>
            {list(toPay)}
          </section>
        ) : null}

        {showPending && accumulateGroups.length > 0 ? (
          <section className={styles.section} aria-labelledby="orders-accumulate">
            <Heading level={2} size="lg" id="orders-accumulate">
              {b.sections.accumulate}
            </Heading>
            <Text tone="muted">{b.accumulateIntro}</Text>
            {accumulateGroups.map((group) => (
              <Panel key={group.sellerId} className={styles.group}>
                <Heading level={3} size="md">
                  {group.orders[0]!.view.counterpart}
                </Heading>
                <RequestDeliveryForm
                  orders={group.orders.map(({ view }) => ({
                    id: view.order.id,
                    sessionTitle: view.sessionTitle,
                    itemsTotalCents: view.order.items_total_cents,
                    accumulateUntil: view.order.accumulate_until,
                    graceUntil:
                      view.order.accumulate_notice_at && view.order.accumulate_grace_until
                        ? view.order.accumulate_grace_until
                        : null,
                  }))}
                />
              </Panel>
            ))}
          </section>
        ) : null}

        {showPending && activeDeliveries.length > 0 ? (
          <section className={styles.section} aria-labelledby="orders-deliveries">
            <Heading level={2} size="lg" id="orders-deliveries">
              {b.sections.deliveries}
            </Heading>
            <ul className={styles.list}>
              {activeDeliveries.map((view) => (
                <li key={view.delivery.id}>
                  <DeliveryCard view={view} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!showPending && hasHistory ? (
          <section className={styles.section} aria-labelledby="orders-history">
            <Heading level={2} size="lg" id="orders-history">
              {b.sections.history}
            </Heading>
            {list(history)}
            {doneDeliveries.length > 0 ? (
              <ul className={styles.list}>
                {doneDeliveries.map((view) => (
                  <li key={view.delivery.id}>
                    <DeliveryCard view={view} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </Container>
    </ToastProvider>
  );
}
