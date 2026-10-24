import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export type AnyClient = SupabaseClient;

/** Service role. Solo para preparar/limpiar datos de prueba. */
export function adminClient(): AnyClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

/** Cliente anónimo (lo que ve un visitante). */
export function anonClient(): AnyClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
