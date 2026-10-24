import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { emailService } from '@/services/email.service';
import { AppError } from '@/utils/errors';
import type { Profile, Seller, SignInResult, SignUpResult } from '../types';
import { termsRedirectTo } from '../utils/routeGuard';
import { toEmailKey } from '../utils/emailCode.utils';
import { captchaService } from './captcha.service';
import { emailCodeService } from './emailCode.service';
import { findUserByEmail } from './userLookup';
import { establishSession } from './sessionLink';

/** Emite y envía un código solo si el correo pertenece a un usuario verificado. No revela nada ni lanza. */
export async function sendCodeIfUserExists(
  email: string,
  purpose: 'login' | 'reset_password',
  ip?: string,
): Promise<void> {
  try {
    const user = await findUserByEmail(email);
    if (!user?.email_confirmed_at) return;
    const { code } = await emailCodeService.issue(email, purpose, { userId: user.id, ip });
    await emailService.send({
      to: email,
      template: purpose === 'login' ? 'loginCode' : 'resetPassword',
      data: { code },
    });
  } catch (error) {
    // Sin correo ni código en el log (docs/spec/auth.md, Seguridad).
    console.error(
      `[auth] ${purpose}_request_failed`,
      error instanceof AppError ? error.code : 'unknown',
    );
  }
}

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
    captchaToken?: string;
  }): Promise<SignUpResult> {
    await captchaService.check(input.captchaToken, input.ip);
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

    await establishSession(key);
    await this.sendWelcome(result.userId, key);
  },

  /** Bienvenida tras el primer acceso verificado. Un fallo de correo no debe romper el registro. */
  async sendWelcome(userId: string, email: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      await emailService.send({
        to: email,
        template: 'welcome',
        data: { displayName: profile?.display_name ?? 'Usuario', isSeller: false },
      });
    } catch (error) {
      console.error('[auth] welcome_failed', error instanceof AppError ? error.code : 'unknown');
    }
  },

  /** Reenvío pedido por la persona (con verificación de seguridad). */
  async requestResend(email: string, ip?: string, captchaToken?: string): Promise<void> {
    await captchaService.check(captchaToken, ip);
    await this.resendCode(email, ip);
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
    captchaToken?: string;
  }): Promise<SignInResult> {
    const supabaseToken = await captchaService.check(input.captchaToken, input.ip, {
      forSupabase: true,
    });
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmailKey(input.email),
      password: input.password,
      options: supabaseToken ? { captchaToken: supabaseToken } : undefined,
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

  /**
   * Acceso por código (A5): respuesta siempre genérica. Solo se envía si el correo existe y está verificado;
   * cualquier fallo interno (cooldown, límite, correo) se registra sin revelar nada a quien consulta.
   */
  async requestLoginCode(email: string, ip?: string, captchaToken?: string): Promise<void> {
    await captchaService.check(captchaToken, ip);
    await sendCodeIfUserExists(email, 'login', ip);
  },

  /** Valida el código de acceso y abre la sesión. `invalid` se muestra como `incorrect` para no revelar nada. */
  async verifyLoginCode(email: string, code: string): Promise<void> {
    const key = toEmailKey(email);
    const result = await emailCodeService.verify(key, 'login', code);
    if (!result.ok)
      throw new AppError(
        result.reason === 'invalid' ? 'incorrect' : result.reason,
        'Código no válido',
      );
    if (!result.userId) throw new AppError('incorrect', 'Código no válido');
    await establishSession(key);
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

  /**
   * Para server components protegidos: sin sesión redirige a /login?next=; con términos pendientes, a
   * /onboarding/terms (salvo `allowPendingTerms`, para la propia página de aceptación).
   */
  async requireUser(
    nextPath = '/',
    options: { allowPendingTerms?: boolean } = {},
  ): Promise<{ user: User; profile: Profile }> {
    const user = await this.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    const profile = await this.getProfile(user.id);
    if (!profile) redirect('/login');
    if (!profile.accepted_terms_at && !options.allowPendingTerms)
      redirect(termsRedirectTo(nextPath));
    return { user, profile };
  },

  /**
   * Zona de vendedor (`/dashboard/**`): sin `seller_profiles` lleva al onboarding. Reutiliza `requireUser`
   * (sesión y términos).
   */
  async requireSeller(nextPath = '/dashboard') {
    const { user, profile } = await this.requireUser(nextPath);
    const supabase = await createClient();
    const { data } = await supabase
      .from('seller_profiles')
      .select('user_id, slug, shop_name, bio, city, payment_instructions, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) redirect('/onboarding/seller');
    return { user, profile, seller: data as Seller };
  },

  /** Los términos los escribe el servidor: el usuario no tiene privilegio sobre `accepted_terms_at`. */
  async acceptTerms(userId: string): Promise<void> {
    const { error } = await createAdminClient()
      .from('profiles' as never)
      .update({ accepted_terms_at: new Date().toISOString() } as never)
      .eq('id' as never, userId as never);
    if (error) throw new AppError('terms_failed', 'No se pudieron guardar los términos', error);
  },
};
