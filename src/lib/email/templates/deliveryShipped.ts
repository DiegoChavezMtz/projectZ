import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type DeliveryShippedData = {
  displayName: string;
  shopName: string;
  method: 'shipping' | 'pickup';
  trackingCode?: string;
};

export function deliveryShipped(data: DeliveryShippedData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  const shipping = data.method === 'shipping';
  const paragraphs = [
    shipping
      ? c.deliveryShipped.bodyShipping(data.shopName)
      : c.deliveryShipped.bodyPickup(data.shopName),
  ];
  if (data.trackingCode) paragraphs.push(c.deliveryShipped.tracking(data.trackingCode));
  return notice({
    subject: shipping ? c.deliveryShipped.subjectShipping : c.deliveryShipped.subjectPickup,
    greeting: c.greeting(data.displayName),
    paragraphs,
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
