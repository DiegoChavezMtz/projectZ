const FALLBACK = '/';
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
