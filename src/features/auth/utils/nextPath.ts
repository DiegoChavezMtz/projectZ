/**
 * Destino por defecto tras iniciar sesión: `/app` decide según la persona (con tienda → `/dashboard`,
 * sin tienda → `/orders`, «Mis cuentas»). Es también lo que vale cuando `next` falta o no es seguro.
 */
export const DEFAULT_APP_PATH = '/app';
const FALLBACK = DEFAULT_APP_PATH;
// Origen ficticio solo para resolver la ruta y comprobar que no se sale de él.
const BASE = 'http://zlotify.invalid';

/**
 * Devuelve una ruta interna segura para `next`, o `fallback`.
 * Solo acepta rutas relativas que empiezan con `/` y no con `//`; rechaza `\`, esquemas y caracteres de control.
 */
export function sanitizeNextPath(value: unknown, fallback: string = FALLBACK): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
