import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { formatDate, formatDateTime } from '@/utils/dates';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { orderQueries } from '../../services/orderQueries';
import { requireUser } from '../../services/session.context';
import type { ProofView } from '../../types';
import { canRequestDelivery } from '../../utils/accumulate';
import { objectionWindowOpen, toOrderTiming } from '../../utils/orderTiming';
import { AccumulateChoice } from '../AccumulateChoice';
import { ConfirmReceiptButton, ObjectionForm, ReleaseOrderButton } from '../BuyerActions';
import { Countdown } from '../Countdown';
import { ProofUploader } from '../ProofUploader';
import { RequestDeliveryForm } from '../RequestDeliveryForm';
import { DeliveryStatusBadge, OrderStatusBadge } from '../StatusBadge';
import { ToastProvider } from '@/context/ToastContext';
import styles from './OrderDetailView.module.css';

const c = fulfillmentContent;
const d = c.buyer.detail;
const MAX_REVIEWING = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Proofs({ proofs }: { proofs: ProofView[] }) {
  if (proofs.length === 0) return <Text tone="muted">{d.noProofs}</Text>;
  return (
    <ul className={styles.proofs}>
      {proofs.map((proof) => (
        <li key={proof.id} className={styles.proof}>
          <Badge
            tone={
              proof.status === 'accepted'
                ? 'success'
                : proof.status === 'rejected'
                  ? 'danger'
                  : 'info'
            }
          >
            {c.proofStatus[proof.status]}
          </Badge>
          <Text size="sm" tone="muted">
            {formatDateTime(proof.createdAt)}
          </Text>
          {proof.rejectReason ? (
            <Text size="sm">{d.rejectedReason(proof.rejectReason)}</Text>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** `/orders/[id]`: detalle de una cuenta del comprador (SSR) con todas las acciones disponibles según su estado. */
export async function OrderDetailView({ orderId }: { orderId: string }) {
  // Las comparaciones con la hora actual se resuelven en cada petición, no al prerenderizar.
  await connection();
  if (!UUID.test(orderId)) notFound();
  const { supabase, userId } = await requireUser(`/orders/${orderId}`);
  const found = await orderQueries.buyerOrder(supabase, userId, orderId);
  if (!found) notFound();
  const { view, delivery } = found;
  const { order } = view;

  const canPay = ['awaiting_payment', 'payment_review'].includes(order.status);
  const feeToPay = delivery?.delivery.status === 'awaiting_payment';
  const instructions =
    canPay || feeToPay ? await orderQueries.instructionsFor(supabase, order.id) : null;
  const reviewing = view.proofs.filter((p) => p.status === 'submitted').length;
  const total = order.total_cents ?? order.items_total_cents + order.shipping_cents;
  const canChoose =
    order.status === 'awaiting_payment' && view.allowAccumulate && !order.proof_submitted_at;
  const needsAddress =
    !order.accumulate && order.delivery_method === 'shipping' && !order.address_snapshot;
  const timing = toOrderTiming(order);
  const guardadito = canRequestDelivery(timing);
  const graceExpired = order.accumulate_notice_at && order.accumulate_grace_until;
  const deliveryProofs = delivery?.proofs ?? [];
  const deliveryReviewing = deliveryProofs.filter((p) => p.status === 'submitted').length;
  const disputeOpen =
    order.status === 'unpaid' && !view.dispute && objectionWindowOpen(order.unpaid_at);

  return (
    <ToastProvider>
      <Container size="narrow" className={styles.root}>
        <Link href="/orders" className={styles.back}>
          ← {d.back}
        </Link>

        <header className={styles.header}>
          <div>
            <Heading level={1} size="xl">
              {view.sessionTitle}
            </Heading>
            <Text tone="muted">{view.counterpart}</Text>
          </div>
          <OrderStatusBadge status={order.status} />
        </header>

        <Panel tone="raised" className={styles.section}>
          <Heading level={2} size="lg">
            {d.itemsTitle}
          </Heading>
          <ul className={styles.items}>
            {view.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <span>{item.title}</span>
                <span>{formatMXN(item.priceCents)}</span>
              </li>
            ))}
          </ul>
          <dl className={styles.totals}>
            <div>
              <dt>{c.common.subtotal}</dt>
              <dd>{formatMXN(order.items_total_cents)}</dd>
            </div>
            {order.status !== 'pending_close' ? (
              <div>
                <dt>{c.common.shipping}</dt>
                <dd>
                  {order.shipping_deferred
                    ? '—'
                    : order.shipping_cents > 0
                      ? formatMXN(order.shipping_cents)
                      : c.common.shippingNone}
                </dd>
              </div>
            ) : null}
            <div className={styles.grand}>
              <dt>{c.common.total}</dt>
              <dd>{formatMXN(total)}</dd>
            </div>
          </dl>
        </Panel>

        {order.status === 'pending_close' ? (
          <Panel className={styles.section}>
            <Text>{d.pendingClose}</Text>
          </Panel>
        ) : null}

        {canPay ? (
          <Panel tone="raised" className={styles.section}>
            <Heading level={2} size="lg">
              {d.payTitle}
            </Heading>
            {order.pay_due_at ? <Countdown dueAt={order.pay_due_at} /> : null}
            <Text tone="muted">{d.payHint}</Text>
            {instructions ? (
              <pre className={styles.instructions}>{instructions}</pre>
            ) : (
              <Text tone="muted">{d.noInstructions}</Text>
            )}

            {canChoose ? (
              <AccumulateChoice
                orderId={order.id}
                accumulate={order.accumulate}
                itemsTotalCents={order.items_total_cents}
                closeShippingCents={order.close_shipping_cents}
                accumulateDays={view.accumulateDays}
              />
            ) : null}

            {order.status === 'awaiting_payment' || reviewing < MAX_REVIEWING ? (
              <ProofUploader
                target="order"
                targetId={order.id}
                needsAddress={needsAddress}
                allowPickupNote={
                  !order.accumulate &&
                  order.delivery_method === 'pickup' &&
                  !order.proof_submitted_at
                }
              />
            ) : null}
          </Panel>
        ) : null}

        {view.proofs.length > 0 || canPay ? (
          <Panel className={styles.section}>
            <Heading level={2} size="lg">
              {d.proofsTitle}
            </Heading>
            <Proofs proofs={view.proofs} />
          </Panel>
        ) : null}

        {order.status === 'paid' && !delivery && !order.accumulate ? (
          <Panel className={styles.section}>
            <Text>{d.paidWaiting}</Text>
          </Panel>
        ) : null}

        {guardadito ? (
          <Panel tone="raised" className={styles.section}>
            <Heading level={2} size="lg">
              {c.buyer.sections.accumulate}
            </Heading>
            {order.accumulate_until ? (
              <Text tone="muted">
                {c.buyer.guardadito.reminder(formatDate(order.accumulate_until))}
              </Text>
            ) : null}
            <RequestDeliveryForm
              orders={[
                {
                  id: order.id,
                  sessionTitle: view.sessionTitle,
                  itemsTotalCents: order.items_total_cents,
                  accumulateUntil: order.accumulate_until,
                  graceUntil: graceExpired ? order.accumulate_grace_until : null,
                },
              ]}
            />
            <ReleaseOrderButton orderId={order.id} />
          </Panel>
        ) : null}

        {delivery ? (
          <Panel tone="raised" className={styles.section}>
            <div className={styles.header}>
              <Heading level={2} size="lg">
                {d.deliveryTitle}
              </Heading>
              <DeliveryStatusBadge status={delivery.delivery.status} />
            </div>
            <Text tone="muted">{c.method[delivery.delivery.method]}</Text>
            {delivery.delivery.tracking_code ? (
              <Text>{d.trackingCode(delivery.delivery.tracking_code)}</Text>
            ) : null}
            {delivery.delivery.status === 'awaiting_payment' && delivery.delivery.pay_due_at ? (
              <>
                <Text>
                  {c.seller.delivery.quote.title}: {formatMXN(delivery.delivery.shipping_cents)}
                </Text>
                <Countdown dueAt={delivery.delivery.pay_due_at} />
                {instructions ? <pre className={styles.instructions}>{instructions}</pre> : null}
              </>
            ) : null}
            {delivery.delivery.status === 'awaiting_payment' ||
            (delivery.delivery.status === 'payment_review' && deliveryReviewing < MAX_REVIEWING) ? (
              <ProofUploader
                target="delivery"
                targetId={delivery.delivery.id}
                title={c.buyer.proof.title}
              />
            ) : null}
            {deliveryProofs.length > 0 ? <Proofs proofs={deliveryProofs} /> : null}
            {delivery.delivery.status === 'shipped' ? (
              <ConfirmReceiptButton deliveryId={delivery.delivery.id} />
            ) : null}
            {delivery.delivery.status === 'delivered' ? <Text>{d.received}</Text> : null}
          </Panel>
        ) : null}

        {order.status === 'unpaid' ? (
          <Panel className={styles.section}>
            <Heading level={2} size="lg">
              {d.unpaidTitle}
            </Heading>
            <Text>{d.unpaidText}</Text>
            {view.dispute ? (
              <>
                <Heading level={3} size="md">
                  {d.disputeSent}
                </Heading>
                <Text>{view.dispute.note}</Text>
                <Badge tone="info">{d.disputeStatus[view.dispute.status]}</Badge>
                {view.dispute.resolutionNote ? (
                  <Text size="sm" tone="muted">
                    {view.dispute.resolutionNote}
                  </Text>
                ) : null}
              </>
            ) : disputeOpen ? (
              <ObjectionForm orderId={order.id} />
            ) : null}
          </Panel>
        ) : null}

        {order.status === 'released' ? (
          <Panel className={styles.section}>
            <Text>{d.releasedText}</Text>
          </Panel>
        ) : null}
      </Container>
    </ToastProvider>
  );
}
