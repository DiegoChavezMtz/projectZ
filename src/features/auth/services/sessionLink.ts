import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createStatelessClient } from '@/lib/supabase/stateless';
import { AppError } from '@/utils/errors';
import { toEmailKey } from '../utils/emailCode.utils';

// Sesión sin contraseña tras verificar un código propio (spike S2-01): enlace magiclink por API admin
// (no envía correo) canjeado con verifyOtp. Solo llamar después de validar un código del propio usuario.
async function hashedTokenFor(email: string): Promise<string> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'magiclink',
    email: toEmailKey(email),
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new AppError('session_failed', 'No se pudo iniciar sesión', error);
  return tokenHash;
}

/** Escribe las cookies de sesión del usuario en la petición actual. */
export async function establishSession(email: string): Promise<void> {
  const tokenHash = await hashedTokenFor(email);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) throw new AppError('session_failed', 'No se pudo iniciar sesión', error);
}

/**
 * Cierra TODAS las sesiones de un usuario. La API admin solo sabe cerrar la sesión de un JWT dado, así que
 * se abre una sesión efímera (sin cookies) y se cierra con `scope: 'global'`, lo que invalida las demás.
 */
export async function revokeAllSessions(email: string): Promise<void> {
  const tokenHash = await hashedTokenFor(email);
  const { data, error } = await createStatelessClient().auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  const accessToken = data.session?.access_token;
  if (error || !accessToken)
    throw new AppError('session_failed', 'No se pudieron cerrar las sesiones', error);
  const { error: signOutError } = await createAdminClient().auth.admin.signOut(
    accessToken,
    'global',
  );
  if (signOutError)
    throw new AppError('session_failed', 'No se pudieron cerrar las sesiones', signOutError);
}

/** Comprueba una contraseña sin tocar la sesión actual (reautenticación). */
export async function checkPassword(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<boolean> {
  const { error } = await createStatelessClient().auth.signInWithPassword({
    email: toEmailKey(email),
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  return !error;
}
