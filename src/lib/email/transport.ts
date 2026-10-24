import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

export type MailEnvelope = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Contrato mínimo del transporte (se sustituye por un mock en pruebas). */
export type MailTransport = {
  send: (mail: MailEnvelope) => Promise<void>;
};

const SEND_TIMEOUT_MS = 10_000;

let cached: MailTransport | undefined;

/** Transporte SMTP configurado solo por variables de entorno (cambiar de proveedor no requiere código). */
export function getTransport(): MailTransport {
  if (cached) return cached;

  const smtp = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });

  cached = {
    send: async (mail) => {
      await smtp.sendMail({
        from: { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM_ADDRESS },
        replyTo: env.EMAIL_REPLY_TO,
        ...mail,
      });
    },
  };
  return cached;
}
