import { emailContent } from '../content/es-MX';
import { codeBlock, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

export type VerifyEmailData = { displayName: string; code: string };

export function verifyEmail(data: VerifyEmailData): RenderedBody {
  const c = emailContent.verifyEmail;
  const greeting = c.greeting(data.displayName);
  return {
    subject: c.subject,
    html:
      heading(greeting) +
      paragraph(c.body) +
      codeBlock(data.code) +
      paragraph(emailContent.code.validity),
    text: `${greeting}\n\n${c.body}\n\n${data.code}\n\n${emailContent.code.validity}`,
  };
}
