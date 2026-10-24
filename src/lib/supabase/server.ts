import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';

// Cliente con la sesión del usuario (cookies). Para server components, Server Actions y route handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Invocado desde un server component: no puede escribir cookies.
            // El proxy ya refresca la sesión en cada petición.
          }
        },
      },
    },
  );
}
