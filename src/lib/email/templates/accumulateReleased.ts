import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type AccumulateReleasedData = {
  displayName: string;
  role: 'buyer' | 'seller';
  /** Nombre del vendedor (si `role` es buyer) o del comprador (si es seller). */
  counterpartName: string;
  reason: 'grace_expired' | 'fee_unpaid' | 'buyer_request';
};

export function accumulateReleased(
  data: AccumulateReleasedData,
  ctx: { appUrl: string },
): RenderedBody {
  const c = emailContent.fulfillment;
  const reason = c.accumulateReleased.reasons[data.reason];
  const buyer = data.role === 'buyer';
  return notice({
    subject: c.accumulateReleased.subject,
    greeting: c.greeting(data.displayName),
    paragraphs: [
      buyer
        ? c.accumulateReleased.bodyBuyer(data.counterpartName, reason)
        : c.accumulateReleased.bodySeller(data.counterpartName, reason),
    ],
    cta: buyer
      ? { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` }
      : { label: c.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
