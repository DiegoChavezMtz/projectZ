import { emailContent } from '../content/es-MX';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type PaymentRejectedData = {
  displayName: string;
  shopName: string;
  reference: string;
  reason: string;
  payDueAt: string;
};

export function paymentRejected(data: PaymentRejectedData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.paymentRejected.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.paymentRejected.body(data.shopName, data.reference, data.reason),
      c.paymentRejected.due(formatDateTime(data.payDueAt)),
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
