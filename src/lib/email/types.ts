import type { ChangeEmailData } from './templates/changeEmail';
import type { LoginCodeData } from './templates/loginCode';
import type { ResetPasswordData } from './templates/resetPassword';
import type { VerifyEmailData } from './templates/verifyEmail';
import type { WelcomeData } from './templates/welcome';
import type { OrderReadyData } from './templates/orderReady';
import type { PaymentReviewData } from './templates/paymentReview';
import type { PaymentConfirmedData } from './templates/paymentConfirmed';
import type { PaymentRejectedData } from './templates/paymentRejected';
import type { PaymentReminderData } from './templates/paymentReminder';
import type { UnpaidNoticeData } from './templates/unpaidNotice';
import type { DeliveryRequestedData } from './templates/deliveryRequested';
import type { DeliveryQuotedData } from './templates/deliveryQuoted';
import type { DeliveryShippedData } from './templates/deliveryShipped';
import type { DeliveryReminderData } from './templates/deliveryReminder';
import type { AccumulateReminderData } from './templates/accumulateReminder';
import type { AccumulateNoticeData } from './templates/accumulateNotice';
import type { AccumulateReleasedData } from './templates/accumulateReleased';

/** Mapa plantilla → datos. */
export type TemplateDataMap = {
  verifyEmail: VerifyEmailData;
  loginCode: LoginCodeData;
  resetPassword: ResetPasswordData;
  changeEmail: ChangeEmailData;
  welcome: WelcomeData;
  orderReady: OrderReadyData;
  paymentReview: PaymentReviewData;
  paymentConfirmed: PaymentConfirmedData;
  paymentRejected: PaymentRejectedData;
  paymentReminder: PaymentReminderData;
  unpaidNotice: UnpaidNoticeData;
  deliveryRequested: DeliveryRequestedData;
  deliveryQuoted: DeliveryQuotedData;
  deliveryShipped: DeliveryShippedData;
  deliveryReminder: DeliveryReminderData;
  accumulateReminder: AccumulateReminderData;
  accumulateNotice: AccumulateNoticeData;
  accumulateReleased: AccumulateReleasedData;
};

export type TemplateName = keyof TemplateDataMap;

export type RenderedBody = { subject: string; html: string; text: string };
export type RenderedEmail = RenderedBody;

export type EmailMessage<T extends TemplateName = TemplateName> = {
  to: string;
  template: T;
  data: TemplateDataMap[T];
};
