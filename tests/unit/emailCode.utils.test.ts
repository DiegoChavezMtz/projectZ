// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  checkCode,
  cooldownRemaining,
  expiryFrom,
  generateCode,
  hashCode,
  hashesMatch,
  isRateLimited,
  MAX_ATTEMPTS,
  type StoredCode,
} from '@/features/auth/utils/emailCode.utils';

const secret = 'x'.repeat(32);
const now = new Date('2026-10-23T12:00:00Z');
const hash = hashCode(secret, 'a@b.co', 'verify_email', '123456');
const stored = (over: Partial<StoredCode> = {}): StoredCode => ({
  code_hash: hash,
  expires_at: expiryFrom(now).toISOString(),
  attempts: 0,
  consumed_at: null,
  ...over,
});

describe('generateCode', () => {
  it('siempre son 6 dígitos', () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('hashCode', () => {
  it('es determinista y normaliza el email', () => {
    expect(hashCode(secret, ' A@B.co ', 'verify_email', '123456')).toBe(hash);
  });
  it('cambia con propósito, código o secreto', () => {
    expect(hashCode(secret, 'a@b.co', 'login', '123456')).not.toBe(hash);
    expect(hashCode(secret, 'a@b.co', 'verify_email', '123457')).not.toBe(hash);
    expect(hashCode('y'.repeat(32), 'a@b.co', 'verify_email', '123456')).not.toBe(hash);
  });
  it('hashesMatch compara en tiempo constante y tolera longitudes distintas', () => {
    expect(hashesMatch(hash, hash)).toBe(true);
    expect(hashesMatch(hash, 'abcd')).toBe(false);
    expect(hashesMatch('', '')).toBe(false);
  });
});

describe('checkCode', () => {
  it('ok con el hash correcto', () => {
    expect(checkCode(stored(), hash, now)).toEqual({ status: 'ok' });
  });
  it('incorrecto cuenta intentos restantes', () => {
    const wrong = hashCode(secret, 'a@b.co', 'verify_email', '000000');
    expect(checkCode(stored(), wrong, now)).toEqual({ status: 'incorrect', attemptsLeft: 4 });
  });
  it('el quinto fallo agota el código', () => {
    const wrong = hashCode(secret, 'a@b.co', 'verify_email', '000000');
    expect(checkCode(stored({ attempts: MAX_ATTEMPTS - 1 }), wrong, now).status).toBe('exhausted');
  });
  it('agotado aunque el código sea correcto', () => {
    expect(checkCode(stored({ attempts: MAX_ATTEMPTS }), hash, now).status).toBe('exhausted');
  });
  it('expirado a los 10 minutos', () => {
    const later = new Date(now.getTime() + 10 * 60 * 1000);
    expect(checkCode(stored(), hash, later).status).toBe('expired');
    expect(checkCode(stored(), hash, new Date(later.getTime() - 1)).status).toBe('ok');
  });
  it('consumido o inexistente es inválido', () => {
    expect(checkCode(null, hash, now).status).toBe('invalid');
    expect(checkCode(stored({ consumed_at: now.toISOString() }), hash, now).status).toBe('invalid');
  });
});

describe('cooldown y límites', () => {
  it('cooldown de 60 s', () => {
    expect(cooldownRemaining(null, now)).toBe(0);
    expect(cooldownRemaining(new Date(now.getTime() - 20_000).toISOString(), now)).toBe(40);
    expect(cooldownRemaining(new Date(now.getTime() - 61_000).toISOString(), now)).toBe(0);
  });
  it('rate limit por email e IP', () => {
    expect(isRateLimited({ byEmail: 4, byIp: 19 })).toBe(false);
    expect(isRateLimited({ byEmail: 5, byIp: 0 })).toBe(true);
    expect(isRateLimited({ byEmail: 0, byIp: 20 })).toBe(true);
    expect(isRateLimited({ byEmail: 0, byIp: null })).toBe(false);
  });
});
