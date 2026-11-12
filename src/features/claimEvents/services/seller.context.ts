import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Id del vendedor en sesión. `/dashboard/**` ya exige tienda (guard de la feature auth, compuesto en `app/`);
 * aquí solo se resuelve la identidad. RLS y la FK a `seller_profiles` siguen siendo la barrera real.
 */
export async function requireSellerId(nextPath = '/dashboard/claims'): Promise<string> {
  // La sesión depende de la petición (y de la hora): se resuelve en cada solicitud, no al prerenderizar.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return data.user.id;
}
