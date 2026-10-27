// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const cookieSet = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }));
const envMock = vi.hoisted(() => ({
  EMAIL_CODE_SECRET: 'z'.repeat(40),
  APP_ENV: 'production' as 'production' | 'development',
}));
const verify = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/supabase/stateless', () => ({ createStatelessClient: () => ({}) }));
vi.mock('@/services/email.service', () => ({ emailService: { send: vi.fn() } }));
vi.mock('@/features/auth/services/captcha.service', () => ({ captchaService: { check: vi.fn() } }));
vi.mock('@/features/auth/services/emailCode.service', () => ({
  emailCodeService: { verify, consume: vi.fn(), issue: vi.fn() },
}));

import { recoveryService } from '@/features/auth/services/recovery.service';
import { hasPassword } from '@/features/auth/services/account.service';
import { RESET_COOKIE } from '@/features/auth/utils/resetToken';

beforeEach(() => {
  cookieSet.mockReset();
  cookieStore.set.mockReset();
  verify.mockReset();
});

describe('cookie del token de reset (checklist de auth.md)', () => {
  it('es httpOnly, sameSite=lax, secure en producción y dura 10 minutos', async () => {
    verify.mockResolvedValue({ ok: true, id: 'c1', userId: 'u1', payload: {} });
    await recoveryService.verifyCode('a@b.co', '123456');
    const [name, value, options] = cookieStore.set.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(RESET_COOKIE);
    expect(value).not.toContain('123456');
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 600,
    });
  });

  it('en desarrollo no exige secure (localhost sin HTTPS)', async () => {
    envMock.APP_ENV = 'development';
    verify.mockResolvedValue({ ok: true, id: 'c1', userId: 'u1', payload: {} });
    await recoveryService.verifyCode('a@b.co', '123456');
    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: false });
    envMock.APP_ENV = 'production';
  });

  it('verifica sin consumir y muestra `invalid` como `incorrect` (no revela si el correo existe)', async () => {
    verify.mockResolvedValue({ ok: false, reason: 'invalid' });
    await expect(recoveryService.verifyCode('nadie@x.co', '000000')).rejects.toMatchObject({
      code: 'incorrect',
    });
    expect(verify).toHaveBeenCalledWith('nadie@x.co', 'reset_password', '000000', {
      consume: false,
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});

describe('hasPassword', () => {
  const user = (patch: Partial<User>) => ({ app_metadata: {}, identities: [], ...patch }) as User;
  it('identifica cuentas con contraseña y solo-Google', () => {
    expect(hasPassword(user({ identities: [{ provider: 'email' } as never] }))).toBe(true);
    expect(hasPassword(user({ identities: [{ provider: 'google' } as never] }))).toBe(false);
    expect(hasPassword(user({ app_metadata: { has_password: true } }))).toBe(true);
  });
});

describe('logs sin códigos ni tokens', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it('todo console.* de src/ registra solo una etiqueta y un código de error', () => {
    const calls: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/console\.\w+\([^;]*;/gs)) {
        calls.push(`${relative(process.cwd(), file)}: ${match[0].replace(/\s+/g, ' ')}`);
      }
    }
    const allowed =
      /^[^:]+: console\.error\( ?(`\[auth\] \$\{purpose\}_request_failed`|'\[(?:auth|notify)\] [a-z_]+'), error instanceof AppError \? error\.code : 'unknown',? ?\);$/;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toMatch(allowed);
  });
});
