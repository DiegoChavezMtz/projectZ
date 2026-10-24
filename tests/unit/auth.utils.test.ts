import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from '@/features/auth/utils/nextPath';
import { isReservedHandle } from '@/features/auth/utils/handle';
import {
  codeSchema,
  handleSchema,
  loginSchema,
  passwordSchema,
  signupSchema,
} from '@/features/auth/utils/auth.schemas';

describe('sanitizeNextPath', () => {
  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '/\\/evil.com',
    '///evil.com',
    '/%0d%0a\r\n',
    'evil.com',
    '',
    '/ok\tnope',
  ])('rechaza %j', (value) => expect(sanitizeNextPath(value)).toBe('/'));
  it('rechaza no-strings', () => {
    expect(sanitizeNextPath(undefined)).toBe('/');
    expect(sanitizeNextPath(['/a'])).toBe('/');
  });
  it('acepta rutas internas con query y hash', () => {
    expect(sanitizeNextPath('/account')).toBe('/account');
    expect(sanitizeNextPath('/c/ABC?x=1#y')).toBe('/c/ABC?x=1#y');
  });
  it('usa el fallback indicado', () => {
    expect(sanitizeNextPath('//evil.com', '/account')).toBe('/account');
  });
});

describe('isReservedHandle', () => {
  it('detecta reservados sin importar mayúsculas', () => {
    expect(isReservedHandle('admin')).toBe(true);
    expect(isReservedHandle('Login')).toBe(true);
    expect(isReservedHandle('diego')).toBe(false);
  });
});

describe('esquemas', () => {
  it('contraseña: 8+ con letra y número', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abc1234').success).toBe(false);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });
  it('handle: patrón y reservados', () => {
    expect(handleSchema.safeParse('diego_1').success).toBe(true);
    expect(handleSchema.safeParse('Di').success).toBe(false);
    expect(handleSchema.safeParse('a'.repeat(31)).success).toBe(false);
    expect(handleSchema.safeParse('admin').success).toBe(false);
  });
  it('código: exactamente 6 dígitos', () => {
    expect(codeSchema.safeParse('123456').success).toBe(true);
    expect(codeSchema.safeParse('12345').success).toBe(false);
    expect(codeSchema.safeParse('12345a').success).toBe(false);
  });
  it('signup: exige términos y normaliza el email', () => {
    const base = { email: ' Ana@Mail.COM ', password: 'abc12345', displayName: ' Ana ' };
    const ok = signupSchema.safeParse({ ...base, acceptTerms: true });
    expect(ok.success && ok.data.email).toBe('ana@mail.com');
    expect(ok.success && ok.data.displayName).toBe('Ana');
    expect(signupSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
  it('login: no valida fortaleza', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
