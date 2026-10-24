import type { WelcomeData } from './templates/welcome';

/** Mapa plantilla → datos. Las demás plantillas (verifyEmail, loginCode, …) se agregan en S2/S3. */
export type TemplateDataMap = {
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
