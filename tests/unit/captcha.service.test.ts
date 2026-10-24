// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verify = vi.hoisted(() => vi.fn());
const envMock = vi.hoisted(() => ({ SUPABASE_CAPTCHA_ENABLED: false }));
vi.mock('@/lib/turnstile', () => ({ verifyTurnstileToken: verify }));
vi.mock('@/lib/env', () => ({ env: envMock }));

describe('captchaService', () => {
  beforeEach(() => {
    verify.mockReset();
    envMock.SUPABASE_CAPTCHA_ENABLED = false;
  });

  it('sin token falla sin llamar a Cloudflare', async () => {
    const { captchaService } = await import('@/features/auth/services/captcha.service');
    await expect(captchaService.check(undefined, '1.1.1.1')).rejects.toMatchObject({
      code: 'captcha_failed',
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('token rechazado por Cloudflare falla; aceptado pasa', async () => {
    const { captchaService } = await import('@/features/auth/services/captcha.service');
    verify.mockResolvedValueOnce(false);
    await expect(captchaService.check('t', '1.1.1.1')).rejects.toMatchObject({
      code: 'captcha_failed',
    });
    verify.mockResolvedValueOnce(true);
    await expect(captchaService.check('t', '1.1.1.1')).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledWith('t', '1.1.1.1');
  });

  it('con Captcha de Supabase activo el login delega el token (no se valida dos veces)', async () => {
    const { captchaService } = await import('@/features/auth/services/captcha.service');
    envMock.SUPABASE_CAPTCHA_ENABLED = true;
    await expect(captchaService.check('t', undefined, { forSupabase: true })).resolves.toBe('t');
    expect(verify).not.toHaveBeenCalled();
    // Los flujos que no pasan por Supabase Auth siguen validándose en el servidor.
    verify.mockResolvedValueOnce(true);
    await captchaService.check('t', undefined);
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
