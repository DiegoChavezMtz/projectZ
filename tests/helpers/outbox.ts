import { adminClient } from './supabase';

type OutboxRow = {
  to_email: string;
  template: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const POLL_MS = 250;

/** Espera el correo más reciente a `to` con la plantilla dada. Requiere la tabla email_outbox (S2-02). */
export async function waitForEmail(
  to: string,
  template: string,
  timeoutMs = 10_000,
): Promise<OutboxRow> {
  const admin = adminClient();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data, error } = await admin
      .from('email_outbox')
      .select('to_email, template, payload, created_at')
      .eq('to_email', to)
      .eq('template', template)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(
        `email_outbox no disponible (${error.message}). La tabla llega con la migración de S2-02.`,
      );
    }
    const row = data?.[0] as OutboxRow | undefined;
    if (row) return row;
    if (Date.now() > deadline) throw new Error(`No llegó el correo "${template}" a ${to}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** Código de 6 dígitos del último correo con código enviado a `to`. */
export async function getLastCode(to: string, template = 'verifyEmail'): Promise<string> {
  const row = await waitForEmail(to, template);
  const code = row.payload.code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new Error(`El correo "${template}" no trae un código de 6 dígitos`);
  }
  return code;
}
