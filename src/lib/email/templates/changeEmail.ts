import { emailContent } from '../content/es-MX';
import { codeBlock, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

export type ChangeEmailData = { code: string; newEmail: string };

export function changeEmail(data: ChangeEmailData): RenderedBody {
  const c = emailContent.changeEmail;
  const body = c.body(data.newEmail);
  return {
    subject: c.subject,
    html:
      heading(c.greeting) +
      paragraph(body) +
      codeBlock(data.code) +
      paragraph(emailContent.code.validity),
    text: `${c.greeting}\n\n${body}\n\n${data.code}\n\n${emailContent.code.validity}`,
  };
}
