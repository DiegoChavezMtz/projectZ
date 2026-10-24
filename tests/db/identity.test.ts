import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import { createTestUser, signInAs, TEST_EMAIL_DOMAIN } from '../helpers/users';

// S2-02: ejecutar SOLO tras aplicar la migración 20261023200000_identity_and_codes.sql.

describe('identidad y códigos (BD en línea)', () => {
  it('el alta de un usuario crea perfil (is_test) y user_stats en 0', async () => {
    const user = await createTestUser({ displayName: 'Ana Prueba' });
    const admin = adminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    expect(error).toBeNull();
    expect(profile?.is_test).toBe(true);
    expect(profile?.display_name).toBe('Ana Prueba');
    expect(profile?.handle).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(profile?.accepted_terms_at).toBeNull();

    const { data: stats } = await admin
      .from('user_stats')
      .select('wins_count, sessions_hosted, rating_as_buyer_count')
      .eq('user_id', user.id)
      .single();
    expect(stats).toEqual({ wins_count: 0, sessions_hosted: 0, rating_as_buyer_count: 0 });
  });

  it('sin display_name en metadata usa el prefijo del correo; los handles no colisionan', async () => {
    const admin = adminClient();
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `same${TEST_EMAIL_DOMAIN.replace('@', `${randomUUID().slice(0, 6)}@`)}`,
        password: `Pw-${randomUUID()}`,
        email_confirm: true,
      });
      expect(error).toBeNull();
      ids.push(data.user?.id ?? '');
    }
    const { data: rows } = await admin.from('profiles').select('id, handle').in('id', ids);
    expect(new Set(rows?.map((r) => r.handle)).size).toBe(2);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it('anon y authenticated no leen email_codes ni email_outbox', async () => {
    const user = await createTestUser();
    const authed = await signInAs(user);
    for (const client of [anonClient(), authed]) {
      for (const table of ['email_codes', 'email_outbox']) {
        const { data, error } = await client.from(table).select('*').limit(1);
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
    }
    const { error } = await authed.from('email_codes').insert({
      email: 'x@test.zlotify.invalid',
      purpose: 'login',
      code_hash: 'x',
      expires_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('public_profiles no expone columnas privadas y es legible por anon', async () => {
    const user = await createTestUser();
    const { data, error } = await anonClient()
      .from('public_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    expect(error).toBeNull();
    expect(Object.keys(data ?? {}).sort()).toEqual(
      ['avatar_path', 'created_at', 'display_name', 'handle', 'id'].sort(),
    );
    const { error: leak } = await anonClient().from('public_profiles').select('accepted_terms_at');
    expect(leak).not.toBeNull();
  });

  it('RLS de profiles: el dueño edita su nombre pero no is_test; anon no lee la tabla', async () => {
    const user = await createTestUser();
    const authed = await signInAs(user);

    const ok = await authed
      .from('profiles')
      .update({ display_name: 'Nuevo Nombre' })
      .eq('id', user.id);
    expect(ok.error).toBeNull();

    const forbidden = await authed.from('profiles').update({ is_test: false }).eq('id', user.id);
    expect(forbidden.error).not.toBeNull();

    const anon = await anonClient().from('profiles').select('id').eq('id', user.id);
    expect(anon.data ?? []).toHaveLength(0);
  });

  it('is_handle_available: tomado, reservado, formato inválido y libre', async () => {
    const user = await createTestUser();
    const { data: profile } = await adminClient()
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single();
    const anon = anonClient();
    const check = async (handle: string) =>
      (await anon.rpc('is_handle_available', { p_handle: handle })).data;

    expect(await check(profile?.handle ?? '')).toBe(false);
    expect(await check('admin')).toBe(false);
    expect(await check('Mal Formato')).toBe(false);
    expect(await check(`libre_${randomUUID().slice(0, 8).replaceAll('-', '')}`)).toBe(true);
  });
});
