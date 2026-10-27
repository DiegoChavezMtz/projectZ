import { emailContent } from '../content/es-MX';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type DeliveryReminderData = { displayName: string; buyerName: string; shipDueAt: string };

export function deliveryReminder(
  data: DeliveryReminderData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.deliveryReminder.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [c.deliveryReminder.body(data.buyerName, formatDateTime(data.shipDueAt))],
    cta: { label: c.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
