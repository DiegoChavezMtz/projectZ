// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decideRoute, termsRedirectTo } from '@/features/auth/utils/routeGuard';
import { buildOAuthRedirectTo, planOAuthCallback } from '@/features/auth/utils/oauth';
import {
  RESET_TTL_SECONDS,
  readResetToken,
  signResetToken,
} from '@/features/auth/utils/resetToken';
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  requestCodeSchema,
  resetPasswordSchema,
} from '@/features/auth/utils/auth.schemas';

const SECRET = 'x'.repeat(40);
const payload = { codeId: 'c1', userId: 'u1' };

describe('token de reset (cookie firmada)', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('firma y lee el contenido', () => {
    expect(readResetToken(SECRET, signResetToken(SECRET, payload, now), now)).toEqual(payload);
  });

  it('vence a los 10 minutos', () => {
    const token = signResetToken(SECRET, payload, now);
    const justBefore = new Date(now.getTime() + (RESET_TTL_SECONDS - 1) * 1000);
    const after = new Date(now.getTime() + RESET_TTL_SECONDS * 1000);
    expect(readResetToken(SECRET, token, justBefore)).toEqual(payload);
    expect(readResetToken(SECRET, token, after)).toBeNull();
  });

  it('rechaza firmas alteradas, otro secreto, contenido cambiado y basura', () => {
    const token = signResetToken(SECRET, payload, now);
    const [body, signature] = token.split('.') as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ ...payload, userId: 'otro', exp: 9999999999 }),
    ).toString('base64url');
    expect(readResetToken('y'.repeat(40), token, now)).toBeNull();
    expect(readResetToken(SECRET, `${forged}.${signature}`, now)).toBeNull();
    expect(readResetToken(SECRET, `${body}.${signature}x`, now)).toBeNull();
    expect(readResetToken(SECRET, `${body}`, now)).toBeNull();
    expect(readResetToken(SECRET, undefined, now)).toBeNull();
    expect(readResetToken(SECRET, 'a.b.c', now)).toBeNull();
  });
});

describe('OAuth', () => {
  it('construye el redirectTo con next solo si es seguro', () => {
    expect(buildOAuthRedirectTo('https://zlotify.mx')).toBe('https://zlotify.mx/auth/callback');
    expect(buildOAuthRedirectTo('https://zlotify.mx', '/account')).toBe(
      'https://zlotify.mx/auth/callback?next=%2Faccount',
    );
    expect(buildOAuthRedirectTo('https://zlotify.mx', '//evil.com')).toBe(
      'https://zlotify.mx/auth/callback',
    );
    expect(buildOAuthRedirectTo('http://localhost:3000', 'https://evil.com')).toBe(
      'http://localhost:3000/auth/callback',
    );
  });

  it('callback con code válido canjea y respeta un next seguro', () => {
    expect(planOAuthCallback({ code: 'abc', next: '/account/security' })).toEqual({
      kind: 'exchange',
      code: 'abc',
      next: '/account/security',
    });
    expect(planOAuthCallback({ code: 'abc', next: 'https://evil.com' })).toEqual({
      kind: 'exchange',
      code: 'abc',
      next: '/app',
    });
  });

  it('callback sin code, con error del proveedor o code absurdo vuelve a /login?error=', () => {
    expect(planOAuthCallback({})).toEqual({ kind: 'failure', to: '/login?error=oauth_failed' });
    expect(planOAuthCallback({ code: '' })).toEqual({
      kind: 'failure',
      to: '/login?error=oauth_failed',
    });
    expect(planOAuthCallback({ code: 'x'.repeat(3000) })).toEqual({
      kind: 'failure',
      to: '/login?error=oauth_failed',
    });
    expect(planOAuthCallback({ error: 'access_denied', code: 'abc' })).toEqual({
      kind: 'failure',
      to: '/login?error=oauth_cancelled',
    });
  });
});

describe('decideRoute: términos aceptados', () => {
  it('con términos pendientes todo lleva a /onboarding/terms con next', () => {
    expect(decideRoute({ pathname: '/account', hasSession: true, termsAccepted: false })).toEqual({
      action: 'redirect',
      to: '/onboarding/terms?next=%2Faccount',
    });
    expect(decideRoute({ pathname: '/', hasSession: true, termsAccepted: false })).toEqual({
      action: 'redirect',
      to: '/onboarding/terms',
    });
    expect(
      decideRoute({
        pathname: '/dashboard',
        search: '?a=1',
        hasSession: true,
        termsAccepted: false,
      }),
    ).toEqual({ action: 'redirect', to: '/onboarding/terms?next=%2Fdashboard%3Fa%3D1' });
  });

  it('con términos pendientes se pueden leer las páginas legales y la propia aceptación', () => {
    for (const pathname of ['/terminos', '/privacidad', '/onboarding/terms', '/auth/callback']) {
      expect(decideRoute({ pathname, hasSession: true, termsAccepted: false }).action).toBe('next');
    }
  });

  it('con términos aceptados o sin consultar, no estorba; /onboarding/terms ya no hace falta', () => {
    expect(
      decideRoute({ pathname: '/account', hasSession: true, termsAccepted: true }).action,
    ).toBe('next');
    expect(decideRoute({ pathname: '/account', hasSession: true }).action).toBe('next');
    expect(
      decideRoute({
        pathname: '/onboarding/terms',
        search: '?next=/account',
        hasSession: true,
        termsAccepted: true,
      }),
    ).toEqual({ action: 'redirect', to: '/account' });
  });

  it('termsRedirectTo no deja pasar un next inseguro', () => {
    expect(termsRedirectTo('//evil.com')).toBe('/onboarding/terms');
  });
});

describe('schemas de S3', () => {
  it('requestCode normaliza el correo', () => {
    expect(requestCodeSchema.parse({ email: '  Ana@Mail.COM ' }).email).toBe('ana@mail.com');
    expect(requestCodeSchema.safeParse({ email: 'no' }).success).toBe(false);
  });

  it('resetPassword exige contraseña válida y confirmación igual', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'Abc12345', confirmPassword: 'Abc12345' }).success,
    ).toBe(true);
    const mismatch = resetPasswordSchema.safeParse({
      password: 'Abc12345',
      confirmPassword: 'Abc12346',
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(['confirmPassword']);
    expect(
      resetPasswordSchema.safeParse({ password: 'corta1', confirmPassword: 'corta1' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: 'sololetras', confirmPassword: 'sololetras' })
        .success,
    ).toBe(false);
  });

  it('changePassword acepta currentPassword vacía (el servidor decide si la exige)', () => {
    const result = changePasswordSchema.parse({
      password: 'Abc12345',
      confirmPassword: 'Abc12345',
    });
    expect(result.currentPassword).toBe('');
  });

  it('changeEmail y deleteAccount', () => {
    expect(changeEmailSchema.parse({ newEmail: 'A@B.co' }).newEmail).toBe('a@b.co');
    expect(deleteAccountSchema.safeParse({ handle: '   ' }).success).toBe(false);
    expect(deleteAccountSchema.parse({ handle: ' ana_1 ' }).handle).toBe('ana_1');
  });
});
