import clsx from 'clsx';
import Link from 'next/link';
import { connection } from 'next/server';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { formatDateTime } from '@/utils/dates';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { orderQueries } from '../../services/orderQueries';
import { requireUser } from '../../services/session.context';
import type { DeliveryView, OrderView, SellerTab } from '../../types';
import { isPastDue } from '../../utils/deadlines';
import { SELLER_TABS, bucketSize, parseSellerTab, sellerBuckets } from '../../utils/sellerBuckets';
import { Countdown } from '../Countdown';
import { CloseOrderForm, ProofReview, QuoteForm, ShipForm } from '../SellerActions';
import { DeliveryStatusBadge, OrderStatusBadge } from '../StatusBadge';
import { ToastProvider } from '@/context/ToastContext';
import styles from './SellerOrdersView.module.css';

const c = fulfillmentContent;
const s = c.seller;

function OrderCard({ view, tab }: { view: OrderView; tab: SellerTab }) {
  const { order } = view;
  const total = order.total_cents ?? order.items_total_cents + order.shipping_cents;
  const submitted = view.proofs.filter((p) => p.status === 'submitted');
  const closeLate = tab === 'toClose' && isPastDue(order.close_due_at);

  return (
    <Panel as="article" className={styles.card}>
      <div className={styles.head}>
        <Heading level={3} size="md">
          {view.sessionTitle}
        </Heading>
        <OrderStatusBadge status={order.status} />
      </div>
      <Text size="sm" tone="muted">
        {s.order.buyer(view.counterpart)} · {c.common.items(view.items.length)} ·{' '}
        {tab === 'toClose' ? formatMXN(order.items_total_cents) : formatMXN(total)}
      </Text>
      <details className={styles.items}>
        <summary>{c.buyer.detail.itemsTitle}</summary>
        <ul>
          {view.items.map((item) => (
            <li key={item.id}>
              {item.title} · {formatMXN(item.priceCents)}
            </li>
          ))}
        </ul>
      </details>

      {tab === 'toClose' ? (
        <>
          {closeLate ? (
            <Text size="sm">{s.order.closeLate}</Text>
          ) : (
            <Countdown dueAt={order.close_due_at} />
          )}
          <CloseOrderForm orderId={order.id} />
        </>
      ) : null}

      {tab === 'awaitingPayment' && order.pay_due_at ? (
        <>
          <Text size="sm" tone="muted">
            {s.order.payDue(formatDateTime(order.pay_due_at))}
          </Text>
          <Countdown dueAt={order.pay_due_at} />
        </>
      ) : null}

      {tab === 'toReview' ? (
        <div className={styles.proofs}>
          <Heading level={4} size="sm">
            {s.review.title}
          </Heading>
          {submitted.map((proof, index) => (
            <ProofReview key={proof.id} proof={proof} index={index} />
          ))}
        </div>
      ) : null}

      {tab === 'unpaid' ? (
        <>
          {order.unpaid_at ? (
            <Text size="sm" tone="muted">
              {s.order.unpaidAt(formatDateTime(order.unpaid_at))}
            </Text>
          ) : null}
          {view.dispute ? (
            <Text size="sm">
              {s.order.dispute}: {view.dispute.note}
            </Text>
          ) : null}
        </>
      ) : null}

      {tab === 'released' && order.released_at ? (
        <Text size="sm" tone="muted">
          {s.order.releasedAt(formatDateTime(order.released_at))}
        </Text>
      ) : null}
    </Panel>
  );
}

function DeliveryCard({ view, tab }: { view: DeliveryView; tab: SellerTab }) {
  const { delivery } = view;
  const address = delivery.address_snapshot as Record<string, string> | null;
  const submitted = view.proofs.filter((p) => p.status === 'submitted');

  return (
    <Panel as="article" className={styles.card}>
      <div className={styles.head}>
        <Heading level={3} size="md">
          {s.delivery.buyer(view.counterpart)}
        </Heading>
        <DeliveryStatusBadge status={delivery.status} />
      </div>
      <Text size="sm" tone="muted">
        {c.method[delivery.method]} · {s.delivery.orders(view.orders.length)} ·{' '}
        {view.orders.map((o) => o.sessionTitle).join(', ')}
      </Text>
      {address ? (
        <Text size="sm" className={styles.address}>
          {s.delivery.address}: {address.recipient}, {address.street} {address.exterior}
          {address.interior ? ` int. ${address.interior}` : ''}, {address.neighborhood},{' '}
          {address.city}, {address.state}, C.P. {address.postal_code}. Tel. {address.phone}
          {address.references ? `. ${address.references}` : ''}
        </Text>
      ) : null}
      {delivery.pickup_note ? (
        <Text size="sm">
          {s.delivery.pickupNote}: {delivery.pickup_note}
        </Text>
      ) : null}

      {tab === 'toQuote' ? (
        <>
          <Countdown dueAt={delivery.quote_due_at} />
          <QuoteForm deliveryId={delivery.id} />
        </>
      ) : null}

      {tab === 'awaitingPayment' ? (
        <>
          <Text size="sm" tone="muted">
            {s.delivery.feePending}
          </Text>
          {delivery.pay_due_at ? <Countdown dueAt={delivery.pay_due_at} /> : null}
        </>
      ) : null}

      {tab === 'toReview' ? (
        <div className={styles.proofs}>
          <Heading level={4} size="sm">
            {s.review.title}
          </Heading>
          {submitted.map((proof, index) => (
            <ProofReview key={proof.id} proof={proof} index={index} />
          ))}
        </div>
      ) : null}

      {tab === 'toShip' ? (
        <>
          {delivery.ship_due_at ? (
            <Text size="sm" tone="muted">
              {s.delivery.shipDue(formatDateTime(delivery.ship_due_at))}
            </Text>
          ) : null}
          {delivery.ship_due_at ? <Countdown dueAt={delivery.ship_due_at} /> : null}
          <ShipForm deliveryId={delivery.id} pickup={delivery.method === 'pickup'} />
        </>
      ) : null}

      {tab === 'shipped' && delivery.shipped_at ? (
        <>
          <Text size="sm" tone="muted">
            {s.delivery.shippedAt(formatDateTime(delivery.shipped_at))}
          </Text>
          {delivery.tracking_code ? (
            <Text size="sm">{c.buyer.detail.trackingCode(delivery.tracking_code)}</Text>
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}

/** `/dashboard/orders`: bandejas de cuentas y entregas del vendedor (SSR). */
export async function SellerOrdersView({ tab: rawTab }: { tab?: string }) {
  // Las comparaciones con la hora actual se resuelven en cada petición, no al prerenderizar.
  await connection();
  const tab = parseSellerTab(rawTab);
  const { supabase, userId } = await requireUser('/dashboard/orders');
  const inbox = await orderQueries.forSeller(supabase, userId);
  const buckets = sellerBuckets(inbox);
  const current = buckets[tab];

  return (
    <ToastProvider>
      <Container className={styles.root}>
        <header>
          <Heading level={1} size="xl">
            {s.title}
          </Heading>
          <Text tone="muted">{s.subtitle}</Text>
        </header>

        <nav aria-label={s.tabsLabel} className={styles.tabs}>
          {SELLER_TABS.map((value) => (
            <Link
              key={value}
              href={value === 'toClose' ? '/dashboard/orders' : `/dashboard/orders?tab=${value}`}
              className={clsx(styles.tab, value === tab && styles.active)}
              aria-current={value === tab ? 'page' : undefined}
            >
              {s.tabs[value]}
              <span className={styles.count}>{bucketSize(buckets[value])}</span>
            </Link>
          ))}
        </nav>

        {bucketSize(current) === 0 ? (
          <Panel>
            <Text tone="muted">{s.empty[tab]}</Text>
          </Panel>
        ) : (
          <ul className={styles.list}>
            {current.orders.map((view) => (
              <li key={view.order.id}>
                <OrderCard view={view} tab={tab} />
              </li>
            ))}
            {current.deliveries.map((view) => (
              <li key={view.delivery.id}>
                <DeliveryCard view={view} tab={tab} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </ToastProvider>
  );
}
