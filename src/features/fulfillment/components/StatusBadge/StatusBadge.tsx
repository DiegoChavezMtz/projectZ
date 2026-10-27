import { Badge } from '@/components/atoms/Badge';
import { fulfillmentContent } from '../../content/es-MX';
import type { DeliveryStatus, OrderStatus } from '../../types';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending_close: 'neutral',
  awaiting_payment: 'warning',
  payment_review: 'info',
  paid: 'success',
  unpaid: 'danger',
  released: 'neutral',
  cancelled: 'neutral',
};

const DELIVERY_TONE: Record<DeliveryStatus, Tone> = {
  requested: 'info',
  awaiting_payment: 'warning',
  payment_review: 'info',
  preparing: 'accent',
  shipped: 'accent',
  delivered: 'success',
  cancelled: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{fulfillmentContent.status[status]}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge tone={DELIVERY_TONE[status]}>{fulfillmentContent.deliveryStatus[status]}</Badge>;
}
