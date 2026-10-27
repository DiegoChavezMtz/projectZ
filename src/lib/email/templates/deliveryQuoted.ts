import { emailContent } from '../content/es-MX';
import { formatMXN } from '@/utils/money';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type DeliveryQuotedData = {
  displayName: string;
  shopName: string;
  shippingCents: number;
  payDueAt: string;
};

export function deliveryQuoted(data: DeliveryQuotedData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.deliveryQuoted.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.deliveryQuoted.body(
        data.shopName,
        formatMXN(data.shippingCents),
        formatDateTime(data.payDueAt),
      ),
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
