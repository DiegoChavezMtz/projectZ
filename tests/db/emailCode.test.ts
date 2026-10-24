import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { emailCodeService } from '@/features/auth/services/emailCode.service';
import { adminClient } from '../helpers/supabase';
import { TEST_EMAIL_DOMAIN } from '../helpers/users';

// Integración de emailCodeService contra email_codes. Solo filas de correos @test.zlotify.invalid, borradas al terminar.

const emails: string[] = [];
const newEmail = () => {
  const email = `code-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;
  emails.push(email);
  return email;
};
const wrongCode = (code: string) => (code === '000000' ? '000001' : '000000');
/** Adelanta el reloj de un código: reescribe created_at (para saltar el cooldown) o expires_at. */
const age = (email: string, patch: Record<string, string>) =>
  adminClient().from('email_codes').update(patch).eq('email', email);

afterEach(async () => {
  const admin = adminClient();
  while (emails.length) await admin.from('email_codes').delete().eq('email', emails.pop()!);
});

describe('emailCodeService (BD en línea)', () => {
  it('código válido: devuelve userId/payload y no se puede reutilizar', async () => {
    const email = newEmail();
    const { code } = await emailCodeService.issue(email, 'change_email', {
      payload: { new_email: 'x@y.co' },
    });
    expect(code).toMatch(/^\d{6}$/);

    const ok = await emailCodeService.verify(email, 'change_email', code);
    expect(ok).toEqual({
      ok: true,
      id: expect.any(String),
      userId: null,
      payload: { new_email: 'x@y.co' },
    });
    const again = await emailCodeService.verify(email, 'change_email', code);
    expect(again).toEqual({ ok: false, reason: 'invalid' });
  });

  it('el código en BD está hasheado, nunca en claro', async () => {
    const email = newEmail();
    const { code } = await emailCodeService.issue(email, 'login');
    const { data } = await adminClient().from('email_codes').select('code_hash').eq('email', email);
    expect(data?.[0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain(code);
  });

  it('incorrecto: incrementa intentos y reporta los restantes', async () => {
    const email = newEmail();
    const { code } = await emailCodeService.issue(email, 'verify_email');
    const result = await emailCodeService.verify(email, 'verify_email', wrongCode(code));
    expect(result).toEqual({ ok: false, reason: 'incorrect', attemptsLeft: 4 });
    const { data } = await adminClient().from('email_codes').select('attempts').eq('email', email);
    expect(data?.[0]?.attempts).toBe(1);
    // El correcto sigue valiendo.
    expect((await emailCodeService.verify(email, 'verify_email', code)).ok).toBe(true);
  });

  it('agotado: 5 fallos invalidan el código, incluso el correcto', async () => {
    const email = newEmail();
    const { code } = await emailCodeService.issue(email, 'verify_email');
    let last;
    for (let i = 0; i < 5; i++)
      last = await emailCodeService.verify(email, 'verify_email', wrongCode(code));
    expect(last).toEqual({ ok: false, reason: 'exhausted' });
    expect(await emailCodeService.verify(email, 'verify_email', code)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('expirado', async () => {
    const email = newEmail();
    const { code } = await emailCodeService.issue(email, 'verify_email');
    await age(email, { expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(await emailCodeService.verify(email, 'verify_email', code)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('reemitir invalida el anterior (y respeta el cooldown de 60 s)', async () => {
    const email = newEmail();
    const first = await emailCodeService.issue(email, 'verify_email');
    await expect(emailCodeService.issue(email, 'verify_email')).rejects.toMatchObject({
      code: 'cooldown',
    });

    await age(email, { created_at: new Date(Date.now() - 61_000).toISOString() });
    const second = await emailCodeService.issue(email, 'verify_email');
    if (first.code !== second.code) {
      expect(await emailCodeService.verify(email, 'verify_email', first.code)).toMatchObject({
        ok: false,
      });
    }
    expect((await emailCodeService.verify(email, 'verify_email', second.code)).ok).toBe(true);
  });

  it('límite de tasa: máx. 5 códigos por hora por (email, purpose)', async () => {
    const email = newEmail();
    for (let i = 0; i < 5; i++) {
      await emailCodeService.issue(email, 'login');
      await age(email, { created_at: new Date(Date.now() - 61_000 - i).toISOString() });
    }
    await expect(emailCodeService.issue(email, 'login')).rejects.toMatchObject({
      code: 'rate_limited',
    });
    // Otro propósito del mismo correo tiene su propio contador.
    await expect(emailCodeService.issue(email, 'reset_password')).resolves.toBeDefined();
  });

  it('límite por IP: máx. 20 códigos por hora (se guarda el hash, no la IP)', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 20; i++) await emailCodeService.issue(newEmail(), 'login', { ip });
    await expect(emailCodeService.issue(newEmail(), 'login', { ip })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    const { data } = await adminClient()
      .from('email_codes')
      .select('ip_hash')
      .in('email', emails.slice(0, 1));
    expect(data?.[0]?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
