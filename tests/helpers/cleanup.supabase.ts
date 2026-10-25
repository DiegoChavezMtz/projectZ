import { TEST_EMAIL_DOMAIN } from './users';
import type { CleanupStore } from './cleanup';
import { adminClient } from './supabase';

// 42P01 / PGRST205: la tabla aún no existe (antes de las migraciones de S2). No es un error.
const isMissingTable = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205';

export function supabaseCleanupStore(): CleanupStore {
  const admin = adminClient();
  return {
    async listAuthUsers() {
      const all: { id: string; email: string | undefined }[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        all.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
        if (data.users.length < 1000) return all;
      }
    },
    async getProfileFlags(ids) {
      const flags = new Map<string, boolean>();
      if (ids.length === 0) return flags;
      const { data, error } = await admin.from('profiles').select('id, is_test').in('id', ids);
      if (error) {
        if (isMissingTable(error)) return flags;
        throw error;
      }
      for (const row of data ?? []) flags.set(row.id as string, row.is_test as boolean);
      return flags;
    },
    async deleteUser(id) {
      // Eventos de prueba (y sus artículos, en cascada) antes que el vendedor.
      await admin.from('claim_sessions').delete().eq('seller_id', id).eq('is_test', true);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error && error.status !== 404) throw error;
      // Sin FK a auth.users (migración 20261024120000) el perfil sobrevive al usuario: solo si es de prueba.
      await admin.from('profiles').delete().eq('id', id).eq('is_test', true);
    },
    async deleteOutboxForTestAddresses() {
      const { error } = await admin
        .from('email_outbox')
        .delete()
        .like('to_email', `%${TEST_EMAIL_DOMAIN}`);
      if (error && !isMissingTable(error)) throw error;
    },
  };
}
