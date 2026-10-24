import { defineConfig, devices } from '@playwright/test';

// Puerto propio para no chocar con otro servidor en :3000.
const PORT = 3100;

// e2e contra servidor local (`next dev`) y la BD en línea con cuentas is_test. Bajo demanda, no en CI.
export default defineConfig({
  testDir: './e2e',
  // Un solo worker: el servidor `next dev` compila bajo demanda y la BD en línea es compartida; en paralelo hay carreras de hidratación.
  // `next dev` compila cada ruta la primera vez que se pide: márgenes holgados para no confundirlo con fallos.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Con E2E_BASE_URL se reutiliza (arráncalo con las mismas claves de prueba de Turnstile) un servidor ya levantado (p. ej. otro `next dev` en este directorio).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm dev -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        // Claves de prueba publicadas por Cloudflare: el widget se resuelve solo y siteverify siempre acepta.
        // El proceso hijo recibe estas variables antes que las de .env (Next no pisa las ya definidas).
        env: {
          NEXT_DIST_DIR: '.next-e2e',
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
          SUPABASE_CAPTCHA_ENABLED: 'false',
        },
        timeout: 120_000,
      },
});
