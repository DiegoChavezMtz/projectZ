import { sanitizeNextPath } from './nextPath';

// Reglas de redirección de docs/spec/auth.md (S2: sesión y rutas protegidas; términos y rol llegan en S3).
const PROTECTED_PREFIXES = ['/account', '/dashboard', '/onboarding'];
const GUEST_ONLY_PATHS = ['/login', '/signup'];

const matches = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export type RouteDecision = { action: 'next' } | { action: 'redirect'; to: string };

/** Función pura: decide qué hacer con una petición según ruta y sesión. */
export function decideRoute(input: {
  pathname: string;
  search?: string;
  hasSession: boolean;
}): RouteDecision {
  const { pathname, search = '', hasSession } = input;

  if (!hasSession && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const next = sanitizeNextPath(`${pathname}${search}`);
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(next)}` };
  }

  if (hasSession && GUEST_ONLY_PATHS.some((p) => matches(pathname, p))) {
    const next = sanitizeNextPath(new URLSearchParams(search).get('next'));
    return { action: 'redirect', to: next };
  }

  return { action: 'next' };
}
