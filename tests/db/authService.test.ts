import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/services/auth.service';
import { emailCodeService } from '@/features/auth/services/emailCode.service';
import { adminClient } from '../helpers/supabase';
import { getLastCode } from '../helpers/outbox';
import { TEST_EMAIL_DOMAIN } from '../helpers/users';

// authService (parte sin cookies) contra la BD en línea. Los usuarios se borran con test:cleanup / afterAll global.

async function signUpTestUser() {
  const email = `svc-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;
  const result = await authService.signUp({
    email,
    password: 'Abc12345',
    displayName: 'Ana Servicio',
  });
  return { email, result };
}

async function cleanup(email: string) {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  await admin.from('email_outbox').delete().eq('to_email', email);
}

describe('authService (BD en línea)', () => {
  it('signUp: usuario sin confirmar, términos guardados, código al outbox y verificable', async () => {
    const { email, result } = await signUpTestUser();
    try {
      expect(result).toEqual({ status: 'verification_sent' });

      const admin = adminClient();
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = users.users.find((u) => u.email === email);
      expect(user?.email_confirmed_at ?? null).toBeNull();

      const { data: profile } = await admin
        .from('profiles')
        .select('is_test, display_name, accepted_terms_at')
        .eq('id', user?.id ?? '')
        .single();
      expect(profile?.is_test).toBe(true);
      expect(profile?.display_name).toBe('Ana Servicio');
      expect(profile?.accepted_terms_at).not.toBeNull();

      const code = await getLastCode(email, 'verifyEmail');
      const verified = await emailCodeService.verify(email, 'verify_email', code);
      expect(verified).toMatchObject({ ok: true, userId: user?.id });
    } finally {
      await cleanup(email);
    }
  });

  it('signUp con correo ya registrado: email_exists y no manda otro correo', async () => {
    const { email } = await signUpTestUser();
    try {
      const admin = adminClient();
      const { count: before } = await admin
        .from('email_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('to_email', email);
      const again = await authService.signUp({ email, password: 'Abc12345', displayName: 'Otra' });
      expect(again).toEqual({ status: 'email_exists' });
      const { count: after } = await admin
        .from('email_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('to_email', email);
      expect(after).toBe(before);
    } finally {
      await cleanup(email);
    }
  });

  it('resendCode: correo desconocido no hace nada; pendiente respeta el cooldown', async () => {
    await expect(
      authService.resendCode(`nadie-${randomUUID()}${TEST_EMAIL_DOMAIN}`),
    ).resolves.toBeUndefined();

    const { email } = await signUpTestUser();
    try {
      await expect(authService.resendCode(email)).rejects.toMatchObject({ code: 'cooldown' });
    } finally {
      await cleanup(email);
    }
  });
});
