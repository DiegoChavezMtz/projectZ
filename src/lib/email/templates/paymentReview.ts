import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type PaymentReviewData = { displayName: string; buyerName: string; reference: string };

export function paymentReview(data: PaymentReviewData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.paymentReview.subject(data.buyerName),
    greeting: c.greeting(data.displayName),
    paragraphs: [c.paymentReview.body(data.buyerName, data.reference)],
    cta: { label: c.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
