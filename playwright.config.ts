import { defineConfig, devices } from '@playwright/test';

// Puerto propio para no chocar con otro servidor en :3000.
const PORT = 3100;

// e2e contra servidor local (`next dev`) y la BD en línea con cuentas is_test. Bajo demanda, no en CI.
export default defineConfig({
  testDir: './e2e',
  // Un solo worker: el servidor `next dev` compila bajo demanda y la BD en línea es compartida; en paralelo hay carreras de hidratación.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Con E2E_BASE_URL se reutiliza un servidor ya levantado (p. ej. otro `next dev` en este directorio).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm dev -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
