import { defineConfig, devices } from '@playwright/test';

// Puerto propio para no chocar con otro servidor en :3000.
const PORT = 3100;

// e2e contra servidor local (`next dev`) y la BD en línea con cuentas is_test. Bajo demanda, no en CI.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
