import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export type AnyClient = SupabaseClient;

// Una conexión estancada no debe colgar una corrida de decenas de usuarios: cada petición caduca y
// los helpers (createTestBuyers) reintentan el error resultante.
const REQUEST_TIMEOUT_MS = 20_000;
const timedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

/** Service role. Solo para preparar/limpiar datos de prueba. */
export function adminClient(): AnyClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: timedFetch },
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
      global: { fetch: timedFetch },
    },
  );
}
