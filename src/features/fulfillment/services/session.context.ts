import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Usuario en sesión (comprador o vendedor) con el cliente que respeta RLS. Sin sesión, lleva a /login. */
export async function requireUser(nextPath: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { supabase, userId: data.user.id };
}
