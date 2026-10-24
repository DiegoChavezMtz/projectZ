import { describe, expect, it } from 'vitest';
import { anonClient } from '../helpers/supabase';

describe('clientes Supabase (BD en línea)', () => {
  it('un visitante no tiene sesión', async () => {
    const supabase = anonClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    expect(sessionError).toBeNull();
    expect(sessionData.session).toBeNull();

    const { data: userData } = await supabase.auth.getUser();
    expect(userData.user).toBeNull();
  });
});
