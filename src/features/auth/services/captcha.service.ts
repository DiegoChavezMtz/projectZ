import 'server-only';
import { env } from '@/lib/env';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { AppError } from '@/utils/errors';

// Anti abuso (A14): Turnstile se valida en el servidor antes de cualquier acción pública sensible.
// Los tokens son de un solo uso: con Captcha protection de Supabase ON, el login se lo deja a Supabase
// (SUPABASE_CAPTCHA_ENABLED) en lugar de validarlo dos veces.
export const captchaService = {
  /**
   * Lanza `captcha_failed` si el token falta o es inválido. Devuelve el token que debe pasarse como
   * `captchaToken` a Supabase Auth (solo cuando Supabase lo valida), o undefined.
   */
  async check(
    token: string | undefined,
    ip: string | undefined,
    options: { forSupabase?: boolean } = {},
  ): Promise<string | undefined> {
    if (!token) throw new AppError('captcha_failed', 'Falta la verificación de seguridad');
    if (options.forSupabase && env.SUPABASE_CAPTCHA_ENABLED) return token;
    if (!(await verifyTurnstileToken(token, ip)))
      throw new AppError('captcha_failed', 'Verificación de seguridad inválida');
    return undefined;
  },
};
