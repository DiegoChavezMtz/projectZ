'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { buildOAuthRedirectTo } from '../utils/oauth';
import { sanitizeNextPath } from '../utils/nextPath';
import { text } from '../utils/formData';

/** Inicia Google con PKCE: el verificador queda en cookies y Supabase devuelve la URL de Google. */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = sanitizeNextPath(text(formData, 'next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: buildOAuthRedirectTo(env.APP_URL, next), skipBrowserRedirect: true },
  });
  if (error || !data.url) redirect('/login?error=oauth_failed');
  redirect(data.url);
}
