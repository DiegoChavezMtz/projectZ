import { emailContent } from './content/es-MX';
import { layout } from './layout';
import type { EmailMessage, RenderedEmail, TemplateDataMap, TemplateName } from './types';
import { changeEmail } from './templates/changeEmail';
import { loginCode } from './templates/loginCode';
import { resetPassword } from './templates/resetPassword';
import { verifyEmail } from './templates/verifyEmail';
import { welcome } from './templates/welcome';
import { orderReady } from './templates/orderReady';
import { paymentReview } from './templates/paymentReview';
import { paymentConfirmed } from './templates/paymentConfirmed';
import { paymentRejected } from './templates/paymentRejected';
import { paymentReminder } from './templates/paymentReminder';
import { unpaidNotice } from './templates/unpaidNotice';
import { deliveryRequested } from './templates/deliveryRequested';
import { deliveryQuoted } from './templates/deliveryQuoted';
import { deliveryShipped } from './templates/deliveryShipped';
import { deliveryReminder } from './templates/deliveryReminder';
import { accumulateReminder } from './templates/accumulateReminder';
import { accumulateNotice } from './templates/accumulateNotice';
import { accumulateReleased } from './templates/accumulateReleased';

type Context = { appUrl: string };
type Template<T extends TemplateName> = (data: TemplateDataMap[T], ctx: Context) => RenderedEmail;

const templates: { [T in TemplateName]: Template<T> } = {
  verifyEmail,
  loginCode,
  resetPassword,
  changeEmail,
  welcome,
  orderReady,
  paymentReview,
  paymentConfirmed,
  paymentRejected,
  paymentReminder,
  unpaidNotice,
  deliveryRequested,
  deliveryQuoted,
  deliveryShipped,
  deliveryReminder,
  accumulateReminder,
  accumulateNotice,
  accumulateReleased,
};

/** Ejemplo de datos por plantilla (pnpm email:preview y tests). */
export const sampleData: TemplateDataMap = {
  verifyEmail: { displayName: 'Diego', code: '123456' },
  loginCode: { code: '123456' },
  resetPassword: { code: '123456' },
  changeEmail: { code: '123456', newEmail: 'nuevo@ejemplo.com' },
  welcome: { displayName: 'Diego', isSeller: true },
  orderReady: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    reference: 'Claim de viernes',
    totalCents: 185000,
    payDueAt: '2026-11-12T18:00:00Z',
  },
  paymentReview: {
    displayName: 'Cartas del Centro',
    buyerName: 'Luis',
    reference: 'Claim de viernes',
  },
  paymentConfirmed: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    reference: 'Claim de viernes',
  },
  paymentRejected: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    reference: 'Claim de viernes',
    reason: 'El comprobante no se alcanza a leer',
    payDueAt: '2026-11-13T18:00:00Z',
  },
  paymentReminder: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    reference: 'Claim de viernes',
    totalCents: 185000,
    payDueAt: '2026-11-12T18:00:00Z',
  },
  unpaidNotice: {
    displayName: 'Luis',
    role: 'buyer',
    counterpartName: 'Cartas del Centro',
    reference: 'Claim de viernes',
  },
  deliveryRequested: {
    displayName: 'Cartas del Centro',
    buyerName: 'Luis',
    method: 'shipping',
    orderCount: 2,
  },
  deliveryQuoted: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    shippingCents: 8000,
    payDueAt: '2026-11-14T18:00:00Z',
  },
  deliveryShipped: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    method: 'shipping',
    trackingCode: 'MX123456789',
  },
  deliveryReminder: {
    displayName: 'Cartas del Centro',
    buyerName: 'Luis',
    shipDueAt: '2026-11-15T18:00:00Z',
  },
  accumulateReminder: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    orderCount: 3,
    untilAt: '2026-12-20T18:00:00Z',
  },
  accumulateNotice: {
    displayName: 'Luis',
    shopName: 'Cartas del Centro',
    orderCount: 3,
    graceUntilAt: '2026-12-23T18:00:00Z',
  },
  accumulateReleased: {
    displayName: 'Luis',
    role: 'buyer',
    counterpartName: 'Cartas del Centro',
    reason: 'grace_expired',
  },
};

/** Compone layout + plantilla → { subject, html, text }. */
export function renderEmail<T extends TemplateName>(
  message: Pick<EmailMessage<T>, 'template' | 'data'>,
  ctx: Context,
): RenderedEmail {
  const render = templates[message.template] as Template<T>;
  const body = render(message.data, ctx);
  return {
    subject: body.subject,
    html: layout({ content: body.html, appUrl: ctx.appUrl }),
    text: `${body.text}\n\n--\n${emailContent.footer.ignore}\n${emailContent.footer.privacy}: ${ctx.appUrl}/privacidad`,
  };
}

export const templateNames = Object.keys(templates) as TemplateName[];
