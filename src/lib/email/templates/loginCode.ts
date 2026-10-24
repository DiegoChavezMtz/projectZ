import { emailContent } from '../content/es-MX';
import { codeBlock, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

export type LoginCodeData = { code: string };

export function loginCode(data: LoginCodeData): RenderedBody {
  const c = emailContent.loginCode;
  return {
    subject: c.subject,
    html:
      heading(c.greeting) +
      paragraph(c.body) +
      codeBlock(data.code) +
      paragraph(emailContent.code.validity),
    text: `${c.greeting}\n\n${c.body}\n\n${data.code}\n\n${emailContent.code.validity}`,
  };
}
