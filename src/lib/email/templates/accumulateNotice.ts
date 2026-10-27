import { emailContent } from '../content/es-MX';
import { formatDateTime } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type AccumulateNoticeData = {
  displayName: string;
  shopName: string;
  orderCount: number;
  graceUntilAt: string;
};

export function accumulateNotice(
  data: AccumulateNoticeData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment;
  return notice({
    subject: c.accumulateNotice.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      c.accumulateNotice.body(data.shopName, data.orderCount, formatDateTime(data.graceUntilAt)),
      c.accumulateNotice.release,
    ],
    cta: { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` },
  });
}
