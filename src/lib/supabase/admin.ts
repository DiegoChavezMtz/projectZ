import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database.types';

// Service role: salta RLS. Solo desde services de servidor, en operaciones explícitas
// (alta de usuario, confirmación de email, cambio de contraseña/email, borrado de cuenta,
// sesión tras verificar código, outbox de pruebas). Nunca importar desde componentes ni hooks.
export function createAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
