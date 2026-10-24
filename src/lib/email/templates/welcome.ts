import { emailContent } from '../content/es-MX';
import { button, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

export type WelcomeData = { displayName: string; isSeller: boolean };

export function welcome(data: WelcomeData, ctx: { appUrl: string }): RenderedBody {
  const c = emailContent.welcome;
  const greeting = c.greeting(data.displayName);
  const body = data.isSeller ? c.bodySeller : c.body;
  return {
    subject: c.subject,
    html: heading(greeting) + paragraph(body) + button(c.cta, ctx.appUrl),
    text: `${greeting}\n\n${body}\n\n${c.cta}: ${ctx.appUrl}`,
  };
}
