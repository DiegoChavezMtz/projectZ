import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { boundariesConfig } from './eslint.boundaries.mjs';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundariesConfig,
  prettier,
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'out/**',
    'build/**',
    'coverage/**',
    '.email-preview/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/types/database.types.ts',
    // Fixtures de violación: se lintean solo desde el test de fronteras.
    'tools/boundary-fixtures/**',
  ]),
]);
