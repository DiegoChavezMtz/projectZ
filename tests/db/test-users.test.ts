import { describe, expect, it } from 'vitest';
import { adminClient } from '../helpers/supabase';
import { cleanupTestData } from '../helpers/cleanup';
import { supabaseCleanupStore } from '../helpers/cleanup.supabase';
import { createTestUser, signInAs, TEST_EMAIL_DOMAIN } from '../helpers/users';

describe('utilidades de prueba (BD en línea)', () => {
  it('crea un usuario verificado, inicia sesión como él y la limpieza lo borra', async () => {
    const user = await createTestUser();
    expect(user.email.endsWith(TEST_EMAIL_DOMAIN)).toBe(true);

    const client = await signInAs(user);
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe(user.id);

    const first = await cleanupTestData(supabaseCleanupStore());
    expect(first.deletedUsers).toContain(user.id);
    const second = await cleanupTestData(supabaseCleanupStore());
    expect(second.deletedUsers).not.toContain(user.id);

    const { data: after } = await adminClient().auth.admin.getUserById(user.id);
    expect(after.user).toBeNull();
  });
});
