// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePublicEnv, parseServerEnv, publicEnvSchema, serverEnvSchema } from '@/lib/env.schema';

const validServer = {
  APP_ENV: 'development',
  APP_URL: 'http://localhost:3000',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_PROJECT_ID: 'proj',
  EMAIL_CODE_SECRET: 'x'.repeat(32),
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_SECURE: 'true',
  EMAIL_FROM_NAME: 'Zlotify',
  EMAIL_FROM_ADDRESS: 'hola@example.com',
  TURNSTILE_SECRET_KEY: 'secret',
};

describe('validación de entorno', () => {
  it('acepta una configuración completa y convierte tipos', () => {
    const env = parseServerEnv(validServer);
    expect(env.SMTP_PORT).toBe(465);
    expect(env.SMTP_SECURE).toBe(true);
    expect(env.EMAIL_REPLY_TO).toBeUndefined();
  });

  it('falla con un mensaje claro que nombra las variables faltantes', () => {
    const attempt = () =>
      parseServerEnv({ ...validServer, SMTP_HOST: undefined, EMAIL_CODE_SECRET: 'corto' });
    expect(attempt).toThrowError(/SMTP_HOST: falta/);
    expect(attempt).toThrowError(/EMAIL_CODE_SECRET: inválida/);
  });

  it('trata variables vacías como ausentes', () => {
    expect(() => parseServerEnv({ ...validServer, SMTP_USER: '' })).toThrowError(
      /SMTP_USER: falta/,
    );
  });

  it('las públicas se validan aparte', () => {
    expect(() => parsePublicEnv({})).toThrowError(/NEXT_PUBLIC_SUPABASE_URL: falta/);
  });
});

describe('separación público / privado', () => {
  it('solo las variables públicas llevan NEXT_PUBLIC_', () => {
    for (const key of Object.keys(publicEnvSchema.shape)) expect(key).toMatch(/^NEXT_PUBLIC_/);
    for (const key of Object.keys(serverEnvSchema.shape)) expect(key).not.toMatch(/^NEXT_PUBLIC_/);
  });

  it('lib/env.ts es server-only', () => {
    const source = readFileSync(resolve(__dirname, '../../src/lib/env.ts'), 'utf8');
    expect(source).toMatch(/^import 'server-only';/m);
  });

  it('ningún módulo de cliente importa lib/env (privado)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
          const source = readFileSync(path, 'utf8');
          const isClient =
            /^['"]use client['"]/m.test(source) || /\/lib\/supabase\/client\.ts$/.test(path);
          const importsPrivate = /from ['"](@\/lib\/env|\.{1,2}\/(?:\.\.\/)*env)['"]/.test(source);
          if (isClient && importsPrivate) offenders.push(path);
        }
      }
    };
    walk(resolve(__dirname, '../../src'));
    expect(offenders).toEqual([]);
  });
});
