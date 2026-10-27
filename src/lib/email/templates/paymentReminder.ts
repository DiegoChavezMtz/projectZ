import { emailContent } from '../content/es-MX';
import { formatMXN } from '@/utils/money';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type PaymentReminderData = {
  displayName: string;
  shopName: string;
  reference: string;
  totalCents: number;
  payDueAt: string;
};

export function paymentReminder(data: PaymentReminderData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.paymentReminder.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.paymentReminder.body(
        data.shopName,
        data.reference,
        formatMXN(data.totalCents),
        formatDateTime(data.payDueAt),
      ),
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
