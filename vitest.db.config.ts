import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Integración contra la BD en línea con cuentas is_test. Corre bajo demanda (pnpm test:db), nunca en CI.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'server-only': resolve(__dirname, 'tests/helpers/server-only.stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    setupFiles: ['./tests/db/setup.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
