import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { emailService } from '@/services/email.service';
import { AppError } from '@/utils/errors';
import type { Profile, SignInResult, SignUpResult } from '../types';
import { toEmailKey } from '../utils/emailCode.utils';
import { emailCodeService } from './emailCode.service';

// Ningún flujo usa correos de Supabase Auth: solo API admin + nuestro backend de correo (docs/spec/auth.md).
const PROFILE_COLUMNS = 'id, handle, display_name, avatar_path, accepted_terms_at, created_at';

async function sendVerificationCode(
  email: string,
  displayName: string,
  userId: string,
  ip?: string,
) {
  const { code } = await emailCodeService.issue(email, 'verify_email', { userId, ip });
  await emailService.send({ to: email, template: 'verifyEmail', data: { displayName, code } });
}

export const authService = {
  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
    ip?: string;
  }): Promise<SignUpResult> {
    const email = toEmailKey(input.email);
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
      user_metadata: { display_name: input.displayName },
    });
    if (error || !data.user) {
      // Decisión documentada (Notas de S2): se ofrece iniciar sesión, sin enviar código.
      if (error?.code === 'email_exists') return { status: 'email_exists' };
      throw new AppError('signup_failed', 'No se pudo crear la cuenta', error);
    }

    // El trigger crea el perfil; los términos los escribe el servidor (no el cliente).
    const { error: termsError } = await admin
      .from('profiles' as never)
      .update({ accepted_terms_at: new Date().toISOString() } as never)
      .eq('id' as never, data.user.id as never);
    if (termsError) throw new AppError('signup_failed', 'No se pudo crear la cuenta', termsError);

    await sendVerificationCode(email, input.displayName, data.user.id, input.ip);
    return { status: 'verification_sent' };
  },

  /** Valida el código propio, confirma el correo por admin y crea la sesión (cookies) sin contraseña. */
  async verifyEmail(email: string, code: string): Promise<void> {
    const key = toEmailKey(email);
    const result = await emailCodeService.verify(key, 'verify_email', code);
    if (!result.ok || !result.userId)
      throw new AppError(result.ok ? 'invalid' : result.reason, 'Código no válido', result);

    const admin = createAdminClient();
    const { error: confirmError } = await admin.auth.admin.updateUserById(result.userId, {
      email_confirm: true,
    });
    if (confirmError) throw new AppError('verify_failed', 'No se pudo verificar', confirmError);

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: key,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash)
      throw new AppError('verify_failed', 'No se pudo iniciar sesión', linkError);

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (error) throw new AppError('verify_failed', 'No se pudo iniciar sesión', error);
  },

  /**
   * Reenvía el código a un correo con registro pendiente. Para cualquier otro correo no hace nada
   * y no lo revela. `cooldown` y `rate_limited` se propagan como AppError.
   */
  async resendCode(email: string, ip?: string): Promise<void> {
    const pending = await emailCodeService.findLatest(email, 'verify_email');
    if (!pending?.user_id) return;

    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(pending.user_id);
    const user = data.user;
    if (!user || user.email_confirmed_at) return;

    const displayName = (user.user_metadata?.display_name as string | undefined) ?? 'Usuario';
    await sendVerificationCode(toEmailKey(email), displayName, user.id, ip);
  },

  /** Mismo error para correo inexistente y contraseña incorrecta. No verificado → reenvía código. */
  async signInWithPassword(input: {
    email: string;
    password: string;
    ip?: string;
  }): Promise<SignInResult> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmailKey(input.email),
      password: input.password,
    });
    if (!error) return { status: 'signed_in' };

    if (error.code === 'email_not_confirmed') {
      try {
        await this.resendCode(input.email, input.ip);
      } catch (resendError) {
        // Un cooldown aquí no cambia el resultado: la persona ya tiene un código vigente.
        if (!(resendError instanceof AppError) || resendError.code === 'email_failed')
          throw resendError;
      }
      return { status: 'unverified' };
    }
    throw new AppError('invalid_credentials', 'Correo o contraseña incorrectos');
  },

  async signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  },

  /** Usuario validado contra Auth (no solo el JWT de la cookie). */
  async getUser(): Promise<User | null> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async getSession(): Promise<{ user: User } | null> {
    const user = await this.getUser();
    return user ? { user } : null;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles' as never)
      .select(PROFILE_COLUMNS)
      .eq('id' as never, userId as never)
      .maybeSingle();
    return (data as Profile | null) ?? null;
  },

  /** Para server components protegidos: sin sesión redirige a /login?next=. */
  async requireUser(nextPath = '/'): Promise<{ user: User; profile: Profile }> {
    const user = await this.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    const profile = await this.getProfile(user.id);
    if (!profile) redirect('/login');
    return { user, profile };
  },
};
