import { sanitizeNextPath } from './nextPath';

// Reglas de redirección de docs/spec/auth.md: sesión, rutas protegidas y términos aceptados.
// El rol de vendedor lo verifica `requireSeller()` en el servidor (necesita consultar la base).
const PROTECTED_PREFIXES = ['/account', '/dashboard', '/onboarding', '/orders'];
const GUEST_ONLY_PATHS = ['/login', '/signup'];
const TERMS_PATH = '/onboarding/terms';
/** Con términos pendientes se puede leer lo legal y cerrar sesión; el resto lleva a aceptarlos. */
const TERMS_EXEMPT_PREFIXES = [TERMS_PATH, '/terminos', '/privacidad', '/auth'];

const matches = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export type RouteDecision = { action: 'next' } | { action: 'redirect'; to: string };

export const termsRedirectTo = (next: string): string => {
  const safe = sanitizeNextPath(next);
  return safe === '/' ? TERMS_PATH : `${TERMS_PATH}?next=${encodeURIComponent(safe)}`;
};

/** Función pura: decide qué hacer con una petición según ruta, sesión y términos. */
export function decideRoute(input: {
  pathname: string;
  search?: string;
  hasSession: boolean;
  /** `undefined` cuando no se consultó (p. ej. sin sesión o petición que no es de página). */
  termsAccepted?: boolean;
}): RouteDecision {
  const { pathname, search = '', hasSession, termsAccepted } = input;

  if (!hasSession && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const next = sanitizeNextPath(`${pathname}${search}`);
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(next)}` };
  }

  if (hasSession && GUEST_ONLY_PATHS.some((p) => matches(pathname, p))) {
    const next = sanitizeNextPath(new URLSearchParams(search).get('next'));
    return { action: 'redirect', to: next };
  }

  if (hasSession && termsAccepted === false) {
    if (!TERMS_EXEMPT_PREFIXES.some((p) => matches(pathname, p)))
      return { action: 'redirect', to: termsRedirectTo(`${pathname}${search}`) };
  }

  if (hasSession && termsAccepted === true && matches(pathname, TERMS_PATH)) {
    return {
      action: 'redirect',
      to: sanitizeNextPath(new URLSearchParams(search).get('next')),
    };
  }

  return { action: 'next' };
}
