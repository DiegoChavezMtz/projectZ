import type { PublicEnv } from './env.schema';

// Seguro para el navegador. Next solo inlinea NEXT_PUBLIC_* referenciadas de forma estática.
// La validación es deliberadamente ligera (sin Zod): este módulo entra en el JS de las páginas con cliente
// de Supabase y Zod pesa ~30 KB gzip. El esquema completo (`publicEnvSchema`) sigue siendo la fuente de
// verdad y una prueba comprueba que ambos coincidan.
const raw: Record<keyof PublicEnv, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
};

const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const problems = (Object.keys(raw) as (keyof PublicEnv)[]).flatMap((name) => {
  const value = raw[name];
  if (value === undefined || value === '') return [`  - ${name}: falta`];
  if (name === 'NEXT_PUBLIC_SUPABASE_URL' && !isUrl(value)) return [`  - ${name}: inválida (URL)`];
  return [];
});

if (problems.length > 0) {
  throw new Error(
    `Variables de entorno públicas inválidas. Revisa .env.local contra .env.example:\n${problems.join('\n')}`,
  );
}

export const publicEnv = raw as PublicEnv;
