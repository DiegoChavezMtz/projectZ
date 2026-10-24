import { emailContent } from '../content/es-MX';
import { codeBlock, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

export type ResetPasswordData = { code: string };

export function resetPassword(data: ResetPasswordData): RenderedBody {
  const c = emailContent.resetPassword;
  return {
    subject: c.subject,
    html:
      heading(c.greeting) +
      paragraph(c.body) +
      codeBlock(data.code) +
      paragraph(emailContent.code.validity) +
      paragraph(c.warning),
    text: `${c.greeting}\n\n${c.body}\n\n${data.code}\n\n${emailContent.code.validity}\n\n${c.warning}`,
  };
}
