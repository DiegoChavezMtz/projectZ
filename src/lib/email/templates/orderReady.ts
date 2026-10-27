import { emailContent } from '../content/es-MX';
import { formatMXN } from '@/utils/money';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type OrderReadyData = {
  displayName: string;
  shopName: string;
  reference: string;
  totalCents: number;
  payDueAt: string;
};

export function orderReady(data: OrderReadyData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.orderReady.subject(data.shopName),
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.orderReady.body(
        data.shopName,
        data.reference,
        formatMXN(data.totalCents),
        formatDateTime(data.payDueAt),
      ),
      c.orderReady.hint,
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
