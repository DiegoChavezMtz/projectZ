import type { LoginCodeData } from './templates/loginCode';
import type { VerifyEmailData } from './templates/verifyEmail';
import type { WelcomeData } from './templates/welcome';

/** Mapa plantilla → datos. Las demás plantillas (resetPassword, changeEmail) se agregan en S3. */
export type TemplateDataMap = {
  verifyEmail: VerifyEmailData;
  loginCode: LoginCodeData;
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
