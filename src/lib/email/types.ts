import type { ChangeEmailData } from './templates/changeEmail';
import type { LoginCodeData } from './templates/loginCode';
import type { ResetPasswordData } from './templates/resetPassword';
import type { VerifyEmailData } from './templates/verifyEmail';
import type { WelcomeData } from './templates/welcome';

/** Mapa plantilla → datos. Las plantillas de cumplimiento llegan en S8. */
export type TemplateDataMap = {
  verifyEmail: VerifyEmailData;
  loginCode: LoginCodeData;
  resetPassword: ResetPasswordData;
  changeEmail: ChangeEmailData;
  welcome: WelcomeData;
};

export type TemplateName = keyof TemplateDataMap;

export type RenderedBody = { subject: string; html: string; text: string };
export type RenderedEmail = RenderedBody;

export type EmailMessage<T extends TemplateName = TemplateName> = {
  to: string;
  template: T;
  data: TemplateDataMap[T];
};
