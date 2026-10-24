import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { emailService } from '@/services/email.service';
import { AppError } from '@/utils/errors';
import { toEmailKey } from '../utils/emailCode.utils';
import { captchaService } from './captcha.service';
import { emailCodeService } from './emailCode.service';
import { checkPassword } from './sessionLink';
import { findUserByEmail } from './userLookup';

/** ¿Tiene contraseña propia? Las cuentas solo-Google la establecen después (marca en app_metadata). */
export const hasPassword = (user: User): boolean =>
  Boolean(user.identities?.some((identity) => identity.provider === 'email')) ||
  user.app_metadata?.has_password === true;

// Cambios de cuenta de un usuario autenticado (A6, A8, A9). Todo con API admin; nunca correos de Supabase.
export const accountService = {
  /** Reautentica con la contraseña actual cuando existe; las cuentas solo-Google no la piden. */
  async reauthenticate(
    user: User,
    currentPassword: string,
    ip: string | undefined,
    captchaToken: string | undefined,
  ): Promise<void> {
    if (!hasPassword(user)) return;
    const supabaseToken = await captchaService.check(captchaToken, ip, { forSupabase: true });
    if (
      !currentPassword ||
      !user.email ||
      !(await checkPassword(user.email, currentPassword, supabaseToken))
    )
      throw new AppError('wrong_password', 'La contraseña actual es incorrecta');
  },

  /** A8. Mantiene la sesión actual y cierra las demás. */
  async changePassword(input: {
    user: User;
    currentPassword: string;
    newPassword: string;
    ip?: string;
    captchaToken?: string;
  }): Promise<void> {
    await this.reauthenticate(input.user, input.currentPassword, input.ip, input.captchaToken);
    const { error } = await createAdminClient().auth.admin.updateUserById(input.user.id, {
      password: input.newPassword,
      app_metadata: { has_password: true },
    });
    if (error) throw new AppError('password_failed', 'No se pudo cambiar la contraseña', error);
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'others' });
  },

  /**
   * A9, paso 1: código al correo NUEVO. Si ya está en uso o hay cooldown/límite no se envía y la respuesta
   * es la misma (no revela qué correos existen).
   */
  async requestEmailChange(input: {
    user: User;
    newEmail: string;
    currentPassword: string;
    ip?: string;
    captchaToken?: string;
  }): Promise<void> {
    await this.reauthenticate(input.user, input.currentPassword, input.ip, input.captchaToken);
    const newEmail = toEmailKey(input.newEmail);
    if (newEmail === input.user.email?.toLowerCase())
      throw new AppError('same_email', 'Ese ya es tu correo');

    try {
      if (await findUserByEmail(newEmail)) return;
      const { code } = await emailCodeService.issue(newEmail, 'change_email', {
        userId: input.user.id,
        payload: { new_email: newEmail },
        ip: input.ip,
      });
      await emailService.send({ to: newEmail, template: 'changeEmail', data: { code, newEmail } });
    } catch (error) {
      if (error instanceof AppError && (error.code === 'cooldown' || error.code === 'rate_limited'))
        return;
      throw error;
    }
  },

  /** A9, paso 2: valida el código y cambia el correo (el viejo sigue vigente hasta aquí). */
  async verifyEmailChange(user: User, newEmail: string, code: string): Promise<void> {
    const key = toEmailKey(newEmail);
    const result = await emailCodeService.verify(key, 'change_email', code);
    if (!result.ok) throw new AppError(result.reason, 'Código no válido');
    if (result.userId !== user.id) throw new AppError('invalid', 'Código no válido');
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
      email: key,
      email_confirm: true,
    });
    if (error) throw new AppError('change_failed', 'No se pudo cambiar el correo', error);
  },

  /** Correo nuevo con código vigente (estado "pendiente de verificación"), o null. */
  async getPendingEmailChange(userId: string): Promise<string | null> {
    const row = await emailCodeService.findPendingForUser(userId, 'change_email');
    const value = row?.payload?.new_email;
    return typeof value === 'string' ? value : null;
  },

  /** A6. Cierra la sesión en todos los dispositivos. */
  async signOutEverywhere(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'global' });
  },
};
