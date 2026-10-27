import { emailContent } from '../content/es-MX';

import type { RenderedBody } from '../types';
import { notice } from './notice';

export type UnpaidNoticeData = {
  displayName: string;
  role: 'buyer' | 'seller';
  /** Nombre del vendedor (si `role` es buyer) o del comprador (si es seller). */
  counterpartName: string;
  reference: string;
};

export function unpaidNotice(data: UnpaidNoticeData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.fulfillment;
  const buyer = data.role === 'buyer';
  return notice({
    subject: buyer
      ? c.unpaidNotice.subjectBuyer
      : c.unpaidNotice.subjectSeller(data.counterpartName),
    greeting: c.greeting(data.displayName),
    paragraphs: buyer
      ? [c.unpaidNotice.bodyBuyer(data.counterpartName, data.reference), c.unpaidNotice.objection]
      : [c.unpaidNotice.bodySeller(data.counterpartName, data.reference)],
    cta: buyer
      ? { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` }
      : { label: c.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
