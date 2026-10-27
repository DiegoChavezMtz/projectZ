import { emailContent } from '../content/es-MX';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type AccumulateReminderData = {
  displayName: string;
  shopName: string;
  orderCount: number;
  untilAt: string;
};

export function accumulateReminder(
  data: AccumulateReminderData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.accumulateReminder.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.accumulateReminder.body(data.shopName, data.orderCount, formatDateTime(data.untilAt)),
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
