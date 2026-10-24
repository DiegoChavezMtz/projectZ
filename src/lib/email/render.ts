import { emailContent } from './content/es-MX';
import { layout } from './layout';
import type { EmailMessage, RenderedEmail, TemplateDataMap, TemplateName } from './types';
import { loginCode } from './templates/loginCode';
import { verifyEmail } from './templates/verifyEmail';
import { welcome } from './templates/welcome';

type Context = { appUrl: string };
type Template<T extends TemplateName> = (data: TemplateDataMap[T], ctx: Context) => RenderedEmail;

const templates: { [T in TemplateName]: Template<T> } = {
  verifyEmail,
  loginCode,
  welcome,
};

/** Ejemplo de datos por plantilla (pnpm email:preview y tests). */
export const sampleData: TemplateDataMap = {
  verifyEmail: { displayName: 'Diego', code: '123456' },
  loginCode: { code: '123456' },
  welcome: { displayName: 'Diego', isSeller: true },
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
