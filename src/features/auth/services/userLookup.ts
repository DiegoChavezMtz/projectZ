import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/utils/errors';
import { toEmailKey } from '../utils/emailCode.utils';

/**
 * Busca un usuario de Auth por correo (solo para decisiones internas; nunca se revela al cliente).
 * La API admin no tiene "get by email" y listar usuarios no escala: `generateLink({ type: 'recovery' })`
 * solo funciona con usuarios existentes, devuelve al usuario y NO envía correo. Si una migración posterior
 * añade una función `security definer`, basta con reemplazar esta implementación.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email: toEmailKey(email),
  });
  if (error) {
    if (error.code === 'user_not_found' || error.status === 404) return null;
    throw new AppError('lookup_failed', 'No se pudo consultar el usuario', error);
  }
  return data.user ?? null;
}
