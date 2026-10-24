import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/utils/errors';
import {
  RESET_COOKIE,
  RESET_TTL_SECONDS,
  readResetToken,
  signResetToken,
  type ResetTokenPayload,
} from '../utils/resetToken';
import { toEmailKey } from '../utils/emailCode.utils';
import { sendCodeIfUserExists } from './auth.service';
import { captchaService } from './captcha.service';
import { emailCodeService } from './emailCode.service';
import { revokeAllSessions } from './sessionLink';

// Recuperar contraseña (A7): solicitud genérica → código → token de un solo uso en cookie → nueva contraseña.
export const recoveryService = {
  /** Siempre responde igual: solo se envía código si el correo es de un usuario verificado. */
  async requestReset(email: string, ip?: string, captchaToken?: string): Promise<void> {
    await captchaService.check(captchaToken, ip);
    await sendCodeIfUserExists(email, 'reset_password', ip);
  },

  /**
   * Verifica el código SIN consumirlo y emite la cookie firmada de 10 min. El código se consume al fijar la
   * contraseña, así que el token solo sirve una vez. `invalid` se muestra como `incorrect` (no revela nada).
   */
  async verifyCode(email: string, code: string): Promise<void> {
    const result = await emailCodeService.verify(toEmailKey(email), 'reset_password', code, {
      consume: false,
    });
    if (!result.ok)
      throw new AppError(
        result.reason === 'invalid' ? 'incorrect' : result.reason,
        'Código no válido',
      );
    if (!result.userId) throw new AppError('incorrect', 'Código no válido');

    const store = await cookies();
    store.set(
      RESET_COOKIE,
      signResetToken(env.EMAIL_CODE_SECRET, { codeId: result.id, userId: result.userId }),
      {
        httpOnly: true,
        secure: env.APP_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: RESET_TTL_SECONDS,
      },
    );
  },

  /** Token vigente de la cookie (firma y vencimiento), o null. No consulta la base. */
  async readToken(): Promise<ResetTokenPayload | null> {
    const store = await cookies();
    return readResetToken(env.EMAIL_CODE_SECRET, store.get(RESET_COOKIE)?.value);
  },

  async clearToken(): Promise<void> {
    (await cookies()).delete(RESET_COOKIE);
  },

  /** Consume el token (una sola vez), fija la contraseña e invalida todas las sesiones del usuario. */
  async resetPassword(newPassword: string): Promise<void> {
    const token = await this.readToken();
    if (!token) throw new AppError('invalid_token', 'El enlace para restablecer ya no es válido');
    if (!(await emailCodeService.consume(token.codeId)))
      throw new AppError('invalid_token', 'El enlace para restablecer ya no es válido');
    await this.clearToken();

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.updateUserById(token.userId, {
      password: newPassword,
      app_metadata: { has_password: true },
    });
    if (error || !data.user?.email)
      throw new AppError('reset_failed', 'No se pudo actualizar la contraseña', error);
    await revokeAllSessions(data.user.email);
  },
};
