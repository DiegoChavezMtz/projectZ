import { AppError } from '@/utils/errors';
import { renderEmail } from './render';
import type { EmailMessage, TemplateName } from './types';
import type { MailTransport } from './transport';

export const TEST_EMAIL_DOMAIN = '@test.zlotify.invalid';
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 500;

export type OutboxEntry = {
  to_email: string;
  template: string;
  subject: string;
  text_body: string;
  html_body: string;
  /** Incluye los datos de la plantilla (el código en claro) para las pruebas. */
  payload: Record<string, unknown>;
};

export type SendDeps = {
  appUrl: string;
  /** Transporte real (SMTP). Solo se usa con destinatarios reales. */
  transport: MailTransport;
  /** Destino de los correos a cuentas de prueba (tabla email_outbox). */
  outbox: (entry: OutboxEntry) => Promise<void>;
  /** Inyectable para no esperar en pruebas. */
  sleep?: (ms: number) => Promise<void>;
};

export const isTestRecipient = (to: string) => to.trim().toLowerCase().endsWith(TEST_EMAIL_DOMAIN);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Renderiza y entrega. Destinatarios @test.zlotify.invalid → outbox (nunca SMTP).
 * Cualquier otro → SMTP con hasta 3 intentos y backoff; si falla, AppError('email_failed') sin detalles internos.
 * Nunca se loguean cuerpos ni códigos.
 */
export async function sendEmail<T extends TemplateName>(
  message: EmailMessage<T>,
  deps: SendDeps,
): Promise<void> {
  const rendered = renderEmail(message, { appUrl: deps.appUrl });
  const to = message.to.trim();

  if (isTestRecipient(to)) {
    await deps.outbox({
      to_email: to,
      template: message.template,
      subject: rendered.subject,
      text_body: rendered.text,
      html_body: rendered.html,
      payload: { ...message.data },
    });
    return;
  }

  const sleep = deps.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await deps.transport.send({ to, ...rendered });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
  throw new AppError('email_failed', 'No se pudo enviar el correo', lastError);
}
