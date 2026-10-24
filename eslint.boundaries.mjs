// Reglas de dependencia de docs/architecture.md (enforcement con eslint-plugin-boundaries v7).
// Se comparte entre eslint.config.mjs y tools/boundary-fixtures/eslint.config.mjs.
import boundaries from 'eslint-plugin-boundaries';

export const boundariesConfig = [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true, project: './tsconfig.json' } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'feature', pattern: 'src/features/*', partialMatch: false, capture: ['name'] },
        { type: 'lib-supabase', pattern: 'src/lib/supabase', partialMatch: false },
        { type: 'lib-email', pattern: 'src/lib/email', partialMatch: false },
        {
          type: 'shared',
          pattern: 'src/(components|hooks|utils|services|context|types|lib|styles|content)',
          partialMatch: false,
        },
      ],
      'boundaries/files': [{ category: 'service', pattern: '**/services/**' }],
    },
    rules: {
      // Reglas 2, 3 y 5 (y dirección app → features → compartido).
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { types: { anyOf: ['feature', 'shared'] } } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  { element: { type: 'shared' } },
                  {
                    element: {
                      type: 'feature',
                      captured: { name: '{{ from.element.captured.name }}' },
                    },
                  },
                ],
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'lib-supabase' } },
              allow: { to: { element: { types: { anyOf: ['shared', 'lib-supabase'] } } } },
            },
            {
              from: { element: { type: 'lib-email' } },
              allow: { to: { element: { types: { anyOf: ['shared', 'lib-email'] } } } },
            },
            // lib/supabase/* y lib/email/* solo desde services/ (src/proxy.ts queda fuera de los elementos: usa lib/supabase/middleware).
            {
              from: {
                element: { types: { anyOf: ['feature', 'shared'] } },
                file: { categories: { anyOf: ['service'] } },
              },
              allow: { to: { element: { types: { anyOf: ['lib-supabase', 'lib-email'] } } } },
            },
          ],
        },
      ],
      // Regla 6 (forma `rules`: con `policies` el plugin v7 no detecta el import profundo; deprecada pero funcional).
      // Regla 6: desde fuera de una feature solo se entra por index.ts.
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          rules: [
            { target: ['feature'], allow: 'index.ts' },
            { target: ['app', 'shared', 'lib-supabase', 'lib-email'], allow: '**' },
          ],
        },
      ],
    },
  },
  // Regla 5: fetch directo solo en services/.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/**', 'src/features/*/services/**', 'src/lib/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'No llames fetch fuera de services/. Usa el service correspondiente.',
        },
      ],
    },
  },
  // Regla 1: app/ solo enruta, sin estado.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['useState', 'useEffect', 'useReducer', 'useContext'],
              message: 'app/ solo enruta. Mueve el estado a una feature.',
            },
          ],
        },
      ],
    },
  },
  // Regla 4: utils y services sin React.
  {
    files: ['src/**/utils/**/*.{ts,tsx}', 'src/**/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'react', message: 'utils/ y services/ son puros: sin React.' }] },
      ],
    },
  },
];
