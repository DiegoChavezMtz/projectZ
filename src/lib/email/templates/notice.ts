import { button, heading, paragraph } from '../layout';
import type { RenderedBody } from '../types';

type Notice = {
  subject: string;
  greeting: string;
  paragraphs: string[];
  cta: { label: string; href: string };
};

/** Estructura común de los avisos de cumplimiento: saludo, párrafos y un botón. */
export function notice({ subject, greeting, paragraphs, cta }: Notice): RenderedBody {
  return {
    subject,
    html: heading(greeting) + paragraphs.map(paragraph).join('') + button(cta.label, cta.href),
    text: `${greeting}\n\n${paragraphs.join('\n\n')}\n\n${cta.label}: ${cta.href}`,
  };
}
