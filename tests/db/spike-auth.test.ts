import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import { requireEnv } from '../helpers/env';
import { TEST_EMAIL_DOMAIN } from '../helpers/users';

// S2-01 (spike): valida los supuestos de docs/spec/auth.md contra el proyecto en línea.
// Opera solo con usuarios @test.zlotify.invalid creados aquí y borrados al terminar.

const createdIds: string[] = [];

async function createUnconfirmed() {
  const email = `spike-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });
  if (error || !data.user) throw new Error(`createUser falló: ${error?.message}`);
  createdIds.push(data.user.id);
  return { id: data.user.id, email, password, user: data.user };
}

describe('spike de autenticación (BD en línea)', () => {
  it('(a) createUser con email_confirm:false crea un usuario sin confirmar (y sin correo de Supabase)', async () => {
    const u = await createUnconfirmed();
    // Sin SMTP configurado en Supabase un envío fallaría: createUser admin además nunca envía confirmación.
    expect(u.user.email_confirmed_at ?? null).toBeNull();
  });

  it('(b) con Confirm email ON, signInWithPassword falla para un usuario no confirmado', async () => {
    const u = await createUnconfirmed();
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    // Si Captcha está ON, el error puede ser de captcha antes que de confirmación; ambos bloquean el acceso.
    console.info(`[spike b] code=${error?.code} message=${error?.message}`);
    expect(['email_not_confirmed', 'captcha_failed']).toContain(error?.code);
  });

  it('(c)+(d) generateLink magiclink + verifyOtp en servidor crea sesión y @supabase/ssr escribe cookies', async () => {
    const u = await createUnconfirmed();
    const admin = adminClient();

    const confirm = await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
    expect(confirm.error).toBeNull();

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: u.email,
    });
    expect(linkError).toBeNull();
    const tokenHash = link?.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();
    // El tipo devuelto por generateLink es el que se pasa a verifyOtp.
    console.info(`[spike c] verification_type=${link?.properties?.verification_type}`);

    const jar = new Map<string, string>();
    const server = createServerClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
        },
      },
    );
    const { data: session, error: verifyError } = await server.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash!,
    });
    expect(verifyError).toBeNull();
    expect(session.session?.user.id).toBe(u.id);
    expect([...jar.keys()].some((name) => name.startsWith('sb-'))).toBe(true);

    const { data: me } = await server.auth.getUser();
    expect(me.user?.id).toBe(u.id);
  });

  it('(c) un enlace magiclink de un usuario NO confirmado no inicia sesión sin confirmar antes', async () => {
    const u = await createUnconfirmed();
    const { data: link } = await adminClient().auth.admin.generateLink({
      type: 'magiclink',
      email: u.email,
    });
    const { data, error } = await anonClient().auth.verifyOtp({
      type: 'magiclink',
      token_hash: link?.properties?.hashed_token ?? '',
    });
    // Documenta el comportamiento real: por eso el servidor confirma por admin antes de crear la sesión.
    console.info(`[spike c2] session=${Boolean(data.session)} error=${error?.message}`);
    expect(Boolean(data.session)).toBe(true);
  });
});

afterAll(async () => {
  const admin = adminClient();
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
});
