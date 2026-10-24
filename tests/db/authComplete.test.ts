import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Sin cookies de petición ni Turnstile real: se simulan el cliente de servidor y el captcha; todo lo demás
// (Auth admin, email_codes, email_outbox, Storage) es la base en línea con usuarios is_test.
const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signOut: signOutMock } }),
}));
vi.mock('@/features/auth/services/captcha.service', () => ({
  captchaService: { check: vi.fn().mockResolvedValue(undefined) },
}));

import { accountDeletionService } from '@/features/auth/services/accountDeletion.service';
import { accountService } from '@/features/auth/services/account.service';
import { authService } from '@/features/auth/services/auth.service';
import { emailCodeService } from '@/features/auth/services/emailCode.service';
import { revokeAllSessions } from '@/features/auth/services/sessionLink';
import { findUserByEmail } from '@/features/auth/services/userLookup';
import { adminClient } from '../helpers/supabase';
import { getLastCode } from '../helpers/outbox';
import { createTestUser, signInAs, TEST_EMAIL_DOMAIN } from '../helpers/users';

const newEmail = () => `s3-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;
const outboxCount = async (to: string, template: string) => {
  const { count } = await adminClient()
    .from('email_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('to_email', to)
    .eq('template', template);
  return count ?? 0;
};

afterEach(() => signOutMock.mockClear());

describe('findUserByEmail', () => {
  it('encuentra al existente y devuelve null (sin crearlo) para uno inexistente', async () => {
    const user = await createTestUser();
    expect((await findUserByEmail(user.email))?.id).toBe(user.id);

    const ghost = newEmail();
    expect(await findUserByEmail(ghost)).toBeNull();
    const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email === ghost)).toBe(false);
  });
});

describe('acceso por código y recuperación: respuesta genérica', () => {
  it('login: envía código solo a un usuario verificado; el inexistente no recibe ni deja rastro', async () => {
    const user = await createTestUser();
    await authService.requestLoginCode(user.email);
    expect(await outboxCount(user.email, 'loginCode')).toBe(1);
    expect(await getLastCode(user.email, 'loginCode')).toMatch(/^\d{6}$/);

    const ghost = newEmail();
    await expect(authService.requestLoginCode(ghost)).resolves.toBeUndefined();
    expect(await outboxCount(ghost, 'loginCode')).toBe(0);
    const { count } = await adminClient()
      .from('email_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', ghost);
    expect(count).toBe(0);
  });

  it('login: un usuario sin verificar no recibe código de acceso', async () => {
    const email = newEmail();
    const { data } = await adminClient().auth.admin.createUser({
      email,
      password: 'Abc12345',
      email_confirm: false,
    });
    expect(data.user).not.toBeNull();
    await authService.requestLoginCode(email);
    expect(await outboxCount(email, 'loginCode')).toBe(0);
  });

  it('login: el cooldown no cambia la respuesta (no revela existencia)', async () => {
    const user = await createTestUser();
    await authService.requestLoginCode(user.email);
    await expect(authService.requestLoginCode(user.email)).resolves.toBeUndefined();
    expect(await outboxCount(user.email, 'loginCode')).toBe(1);
  });
});

describe('sesiones', () => {
  it('revokeAllSessions invalida todas las sesiones existentes del usuario', async () => {
    const user = await createTestUser();
    const a = await signInAs(user);
    const b = await signInAs(user);
    expect((await a.auth.getUser()).data.user?.id).toBe(user.id);

    await revokeAllSessions(user.email);

    expect((await a.auth.getUser()).error).not.toBeNull();
    expect((await b.auth.getUser()).error).not.toBeNull();
    // El usuario sigue existiendo y puede abrir una sesión nueva.
    const c = await signInAs(user);
    expect((await c.auth.getUser()).data.user?.id).toBe(user.id);
  });

  it('logout global (scope: global) deja inválida una segunda sesión', async () => {
    const user = await createTestUser();
    const first = await signInAs(user);
    const second = await signInAs(user);
    await first.auth.signOut({ scope: 'global' });
    expect((await second.auth.getUser()).error).not.toBeNull();
  });
});

describe('token de /reset-password: un solo uso', () => {
  it('verify sin consumir permite usar el código una vez; el segundo consumo falla', async () => {
    const user = await createTestUser();
    const { code } = await emailCodeService.issue(user.email, 'reset_password', {
      userId: user.id,
    });
    const result = await emailCodeService.verify(user.email, 'reset_password', code, {
      consume: false,
    });
    expect(result).toMatchObject({ ok: true, userId: user.id });
    if (!result.ok) throw new Error('inesperado');
    expect(await emailCodeService.consume(result.id)).toBe(true);
    expect(await emailCodeService.consume(result.id)).toBe(false);
  });

  it('un código vencido no se puede consumir', async () => {
    const user = await createTestUser();
    const { code } = await emailCodeService.issue(user.email, 'reset_password', {
      userId: user.id,
    });
    const result = await emailCodeService.verify(user.email, 'reset_password', code, {
      consume: false,
    });
    if (!result.ok) throw new Error('inesperado');
    await adminClient()
      .from('email_codes')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', result.id);
    expect(await emailCodeService.consume(result.id)).toBe(false);
  });
});

describe('cambio de correo (A9)', () => {
  it('manda el código al correo NUEVO; verificar cambia el correo; el viejo seguía vigente antes', async () => {
    const user = await createTestUser();
    const authUser = (await adminClient().auth.admin.getUserById(user.id)).data.user!;
    const newAddress = newEmail();

    await accountService.requestEmailChange({
      user: authUser,
      newEmail: newAddress,
      currentPassword: user.password,
    });
    expect(await outboxCount(newAddress, 'changeEmail')).toBe(1);
    expect(await outboxCount(user.email, 'changeEmail')).toBe(0);
    expect(await accountService.getPendingEmailChange(user.id)).toBe(newAddress);
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user?.email).toBe(user.email);

    const code = await getLastCode(newAddress, 'changeEmail');
    await accountService.verifyEmailChange(authUser, newAddress, code);
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user?.email).toBe(newAddress);
    expect(await accountService.getPendingEmailChange(user.id)).toBeNull();
  });

  it('contraseña actual incorrecta rechaza y no envía nada', async () => {
    const user = await createTestUser();
    const authUser = (await adminClient().auth.admin.getUserById(user.id)).data.user!;
    const target = newEmail();
    await expect(
      accountService.requestEmailChange({
        user: authUser,
        newEmail: target,
        currentPassword: 'mal',
      }),
    ).rejects.toMatchObject({ code: 'wrong_password' });
    expect(await outboxCount(target, 'changeEmail')).toBe(0);
  });

  it('correo ya en uso: respuesta idéntica, sin correo', async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const authUser = (await adminClient().auth.admin.getUserById(user.id)).data.user!;
    await expect(
      accountService.requestEmailChange({
        user: authUser,
        newEmail: other.email,
        currentPassword: user.password,
      }),
    ).resolves.toBeUndefined();
    expect(await outboxCount(other.email, 'changeEmail')).toBe(0);
  });

  it('el código de otro usuario no sirve', async () => {
    const user = await createTestUser();
    const intruder = await createTestUser();
    const authUser = (await adminClient().auth.admin.getUserById(user.id)).data.user!;
    const intruderAuth = (await adminClient().auth.admin.getUserById(intruder.id)).data.user!;
    const target = newEmail();
    await accountService.requestEmailChange({
      user: authUser,
      newEmail: target,
      currentPassword: user.password,
    });
    const code = await getLastCode(target, 'changeEmail');
    await expect(
      accountService.verifyEmailChange(intruderAuth, target, code),
    ).rejects.toMatchObject({
      code: 'invalid',
    });
  });
});

describe('eliminar cuenta (A15)', () => {
  const profileOf = async (id: string) =>
    (
      await adminClient()
        .from('profiles')
        .select('handle, display_name, avatar_path, deleted_at')
        .eq('id', id)
        .maybeSingle()
    ).data as { handle: string; display_name: string; deleted_at: string | null } | null;

  it('handle incorrecto: no toca nada', async () => {
    const user = await createTestUser();
    await expect(
      accountDeletionService.deleteAccount({ userId: user.id, handleConfirmation: 'otro' }),
    ).rejects.toMatchObject({ code: 'handle_mismatch' });
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user).not.toBeNull();
  });

  it('un bloqueo (punto de extensión) impide eliminar y no modifica nada', async () => {
    const user = await createTestUser();
    const profile = (await profileOf(user.id))!;
    const blocker = vi.fn().mockResolvedValue('live_event');
    await expect(
      accountDeletionService.deleteAccount(
        { userId: user.id, handleConfirmation: profile.handle },
        [blocker],
      ),
    ).rejects.toMatchObject({ code: 'deletion_blocked', details: { reasons: ['live_event'] } });
    expect(blocker).toHaveBeenCalledWith(user.id);
    expect((await profileOf(user.id))?.handle).toBe(profile.handle);
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user).not.toBeNull();
  });

  it('anonimiza también la tienda (nombre, datos de contacto y pago) y borra el avatar', async () => {
    const user = await createTestUser();
    const admin = adminClient();
    await admin.from('seller_profiles').insert({
      user_id: user.id,
      slug: `del-${randomUUID().slice(0, 8)}`,
      shop_name: 'Tienda Real',
      bio: 'bio',
      city: 'Puebla',
      payment_instructions: 'CLABE 123',
    });
    await admin.storage
      .from('avatars')
      .upload(`${user.id}/1.webp`, new Blob(['x'], { type: 'image/webp' }), {
        contentType: 'image/webp',
      });
    const profile = (await profileOf(user.id))!;

    await accountDeletionService.deleteAccount(
      { userId: user.id, handleConfirmation: profile.handle },
      [],
    );

    const { data: seller } = await admin
      .from('seller_profiles')
      .select('shop_name, bio, city, payment_instructions')
      .eq('user_id', user.id)
      .single();
    expect(seller).toEqual({
      shop_name: 'Vendedor eliminado',
      bio: null,
      city: null,
      payment_instructions: null,
    });
    const { data: files } = await admin.storage.from('avatars').list(user.id);
    expect(files ?? []).toHaveLength(0);
    await admin.from('profiles').delete().eq('id', user.id).eq('is_test', true);
  });

  it('anonimiza el perfil, cierra la sesión, elimina el usuario y el correo puede volver a registrarse', async () => {
    const user = await createTestUser({ displayName: 'Persona Real' });
    const profile = (await profileOf(user.id))!;
    await accountDeletionService.deleteAccount(
      { userId: user.id, handleConfirmation: profile.handle },
      [],
    );

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'global' });
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user).toBeNull();
    // Sin FK a auth.users (migración 20261024120000) el perfil anonimizado sobrevive como referencia.
    const after = await profileOf(user.id);
    expect(after).not.toBeNull();
    expect(after?.display_name).toBe('Usuario eliminado');
    expect(after?.handle).toBe(`deleted_${user.id.replaceAll('-', '').slice(0, 8)}`);
    expect(after?.deleted_at).not.toBeNull();
    await adminClient().from('profiles').delete().eq('id', user.id).eq('is_test', true);

    const again = await adminClient().auth.admin.createUser({
      email: user.email,
      password: 'Abc12345',
      email_confirm: true,
    });
    expect(again.error).toBeNull();
  });
});
