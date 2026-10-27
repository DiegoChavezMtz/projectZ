import type { DeliveryView, OrderView, SellerInbox, SellerTab } from '../types';

export const SELLER_TABS: SellerTab[] = [
  'toClose',
  'awaitingPayment',
  'toReview',
  'toQuote',
  'toShip',
  'shipped',
  'unpaid',
  'released',
];

export const parseSellerTab = (value: string | undefined): SellerTab =>
  SELLER_TABS.includes(value as SellerTab) ? (value as SellerTab) : 'toClose';

export type SellerBucket = { orders: OrderView[]; deliveries: DeliveryView[] };

/** Reparte cuentas y entregas del vendedor en sus bandejas. Una cuenta o entrega vive en una sola. */
export function sellerBuckets(inbox: SellerInbox): Record<SellerTab, SellerBucket> {
  const buckets: Record<SellerTab, SellerBucket> = {
    toClose: { orders: [], deliveries: [] },
    awaitingPayment: { orders: [], deliveries: [] },
    toReview: { orders: [], deliveries: [] },
    toQuote: { orders: [], deliveries: [] },
    toShip: { orders: [], deliveries: [] },
    shipped: { orders: [], deliveries: [] },
    unpaid: { orders: [], deliveries: [] },
    released: { orders: [], deliveries: [] },
  };

  for (const view of inbox.orders) {
    switch (view.order.status) {
      case 'pending_close':
        buckets.toClose.orders.push(view);
        break;
      case 'awaiting_payment':
        buckets.awaitingPayment.orders.push(view);
        break;
      case 'payment_review':
        buckets.toReview.orders.push(view);
        break;
      case 'unpaid':
        buckets.unpaid.orders.push(view);
        break;
      case 'released':
        buckets.released.orders.push(view);
        break;
      default:
        break;
    }
  }

  for (const view of inbox.deliveries) {
    switch (view.delivery.status) {
      case 'requested':
        if (view.delivery.method === 'shipping') buckets.toQuote.deliveries.push(view);
        break;
      case 'awaiting_payment':
        buckets.awaitingPayment.deliveries.push(view);
        break;
      case 'payment_review':
        buckets.toReview.deliveries.push(view);
        break;
      case 'preparing':
        buckets.toShip.deliveries.push(view);
        break;
      case 'shipped':
        buckets.shipped.deliveries.push(view);
        break;
      default:
        break;
    }
  }
  return buckets;
}

export const bucketSize = (bucket: SellerBucket) => bucket.orders.length + bucket.deliveries.length;
