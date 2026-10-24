import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';

// Refresca la sesión en cada petición y propaga las cookies. Las reglas de ruta viven en src/proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No insertar lógica entre createServerClient y getUser: valida el JWT y dispara el refresco.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Términos aceptados: solo se consulta en peticiones de página con sesión (docs/spec/auth.md). El usuario
  // lee su propio perfil por RLS. Si la consulta falla se deja pasar: las páginas protegidas lo vuelven a validar.
  let termsAccepted: boolean | undefined;
  if (user && (request.method === 'GET' || request.method === 'HEAD')) {
    const { data } = await supabase
      .from('profiles' as never)
      .select('accepted_terms_at')
      .eq('id' as never, user.id as never)
      .maybeSingle();
    if (data)
      termsAccepted = Boolean((data as { accepted_terms_at: string | null }).accepted_terms_at);
  }

  return { response, user, termsAccepted };
}
