import { config } from 'dotenv';
import { resolve } from 'node:path';

let loaded = false;

/** Carga .env.test y luego .env (apunta al proyecto en línea; solo se opera con cuentas is_test). */
export function loadTestEnv(): void {
  if (loaded) return;
  // .env.test tiene prioridad; .env es el respaldo (dotenv no pisa lo ya cargado).
  for (const file of ['.env.test', '.env']) {
    config({ path: resolve(process.cwd(), file), quiet: true });
  }
  loaded = true;
}

export function requireEnv(name: string): string {
  loadTestEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name} en .env.test. Las pruebas test:db / test:cleanup necesitan las claves de Supabase (ver .env.example).`,
    );
  }
  return value;
}
