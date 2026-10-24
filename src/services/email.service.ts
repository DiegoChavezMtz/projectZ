import 'server-only';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, type OutboxEntry } from '@/lib/email/send';
import { getTransport } from '@/lib/email/transport';
import type { EmailMessage, TemplateName } from '@/lib/email/types';
import { AppError } from '@/utils/errors';

// Único punto de uso del módulo de correo desde la app (docs/spec/email.md).
async function writeOutbox(entry: OutboxEntry): Promise<void> {
  const admin = createAdminClient();
  // La tabla email_outbox se crea en la migración de S2-02; hasta correr `pnpm db:types` no está tipada.
  const { error } = await admin.from('email_outbox' as never).insert(entry as never);
  if (error)
    throw new AppError('email_outbox_failed', 'No se pudo guardar el correo de prueba', error);
}

export const emailService = {
  send<T extends TemplateName>(message: EmailMessage<T>): Promise<void> {
    return sendEmail(message, {
      appUrl: env.APP_URL,
      transport: getTransport(),
      outbox: writeOutbox,
    });
  },
};
