import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type DeliveryRequestedData = {
  displayName: string;
  buyerName: string;
  method: 'shipping' | 'pickup';
  orderCount: number;
};

export function deliveryRequested(
  data: DeliveryRequestedData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment.deliveryRequested;
  return notice({
    subject: c.subject(data.buyerName),
    greeting: emailContent.fulfillment.greeting(data.displayName),
    paragraphs: [
      data.method === 'shipping'
        ? c.bodyShipping(data.buyerName, data.orderCount)
        : c.bodyPickup(data.buyerName, data.orderCount),
    ],
    cta: { label: emailContent.fulfillment.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
