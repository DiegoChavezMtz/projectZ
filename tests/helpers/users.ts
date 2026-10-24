import { randomUUID } from 'node:crypto';
import { adminClient, anonClient, type AnyClient } from './supabase';

export const TEST_EMAIL_DOMAIN = '@test.zlotify.invalid';

export type TestUser = { id: string; email: string; password: string; displayName: string };

const created: TestUser[] = [];

/**
 * Crea un usuario de prueba ya verificado (service role, correo @test.zlotify.invalid).
 * `profiles.is_test = true` lo asigna el trigger on_auth_user_created a partir del dominio (S2).
 */
export async function createTestUser(
  options: { displayName?: string; acceptTerms?: boolean } = {},
): Promise<TestUser> {
  const id = randomUUID().slice(0, 8);
  const user: Omit<TestUser, 'id'> = {
    email: `test-${id}${TEST_EMAIL_DOMAIN}`,
    password: `Pw-${randomUUID()}`,
    displayName: options.displayName ?? `Test ${id}`,
  };
  const { data, error } = await adminClient().auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName },
  });
  if (error || !data.user)
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  // Como el registro propio: términos aceptados (S3-03 manda a /onboarding/terms a quien no los tiene).
  if (options.acceptTerms !== false) {
    await adminClient()
      .from('profiles')
      .update({ accepted_terms_at: new Date().toISOString() })
      .eq('id', data.user.id);
  }
  const full = { ...user, id: data.user.id };
  created.push(full);
  return full;
}

/**
 * Cliente autenticado como el usuario de prueba. Con Captcha ON, signInWithPassword exige token,
 * así que se genera un enlace por API admin (no envía correo) y se canjea su token_hash.
 */
export async function signInAs(user: TestUser): Promise<AnyClient> {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`No se pudo preparar la sesión: ${error?.message}`);

  const client = anonClient();
  const { error: verifyError } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyError)
    throw new Error(`No se pudo iniciar sesión como usuario de prueba: ${verifyError.message}`);
  return client;
}

/** Borra solo los usuarios creados por este proceso de pruebas. */
export async function deleteCreatedTestUsers(): Promise<void> {
  const admin = adminClient();
  while (created.length > 0) {
    const user = created.pop();
    if (user) {
      await admin.auth.admin.deleteUser(user.id);
      await admin.from('profiles').delete().eq('id', user.id).eq('is_test', true);
    }
  }
}
