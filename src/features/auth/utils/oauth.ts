import { DEFAULT_APP_PATH, sanitizeNextPath } from './nextPath';

/** URL a la que Supabase devuelve al usuario tras Google. `next` solo viaja si es una ruta interna segura. */
export function buildOAuthRedirectTo(appUrl: string, next?: string | null): string {
  const url = new URL('/auth/callback', appUrl);
  const safe = sanitizeNextPath(next);
  if (safe !== DEFAULT_APP_PATH) url.searchParams.set('next', safe);
  return url.toString();
}

export type CallbackParams = { code?: string | null; error?: string | null; next?: string | null };

export type CallbackPlan =
  { kind: 'exchange'; code: string; next: string } | { kind: 'failure'; to: string };

/** Decide qué hacer con la petición del callback: canjear el `code` o volver a /login con un error. */
export function planOAuthCallback({ code, error, next }: CallbackParams): CallbackPlan {
  if (error) return { kind: 'failure', to: '/login?error=oauth_cancelled' };
  if (!code || code.length > 2048) return { kind: 'failure', to: '/login?error=oauth_failed' };
  return { kind: 'exchange', code, next: sanitizeNextPath(next) };
}
