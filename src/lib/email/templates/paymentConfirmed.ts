import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type PaymentConfirmedData = { displayName: string; shopName: string; reference: string };

export function paymentConfirmed(
  data: PaymentConfirmedData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.paymentConfirmed.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [c.paymentConfirmed.body(data.shopName, data.reference), c.paymentConfirmed.next],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
