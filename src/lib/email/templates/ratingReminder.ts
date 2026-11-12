import { emailContent } from '../content/es-MX';
import { formatDate } from '@/utils/dates';
import type { RenderedBody } from '../types';
import { notice } from './notice';

export type RatingReminderData = {
  displayName: string;
  role: 'buyer' | 'seller';
  /** Nombre del vendedor (si `role` es buyer) o del comprador (si es seller). */
  counterpartName: string;
  reference: string;
  /** Fin de la ventana de 14 días para calificar. */
  rateUntil: string;
};

export function ratingReminder(data: RatingReminderData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.reputation.ratingReminder;
  const buyer = data.role === 'buyer';
  return notice({
    subject: c.subject,
    greeting: emailContent.fulfillment.greeting(data.displayName),
    paragraphs: [c.body(data.counterpartName, data.reference, formatDate(data.rateUntil))],
    cta: buyer
      ? { label: c.ctaBuyer, href: `${ctx.appUrl}/orders` }
      : { label: c.ctaSeller, href: `${ctx.appUrl}/dashboard/orders` },
  });
}
