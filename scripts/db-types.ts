// Genera src/types/database.types.ts desde el proyecto de Supabase en línea.
// Ejecutar SOLO tras confirmar que las migraciones fueron aplicadas a mano. No modifica la base.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectId = process.env.SUPABASE_PROJECT_ID;
if (!projectId) {
  console.error('Falta SUPABASE_PROJECT_ID (y SUPABASE_ACCESS_TOKEN) en .env.local');
  process.exit(1);
}

const run = spawnSync(
  'pnpm',
  [
    'exec',
    'supabase',
    'gen',
    'types',
    'typescript',
    '--project-id',
    projectId,
    '--schema',
    'public',
  ],
  { encoding: 'utf8', env: process.env },
);

if (run.status !== 0 || !run.stdout.trim()) {
  console.error(run.stderr || 'La generación de tipos no devolvió resultado');
  process.exit(run.status ?? 1);
}

writeFileSync(resolve(process.cwd(), 'src/types/database.types.ts'), run.stdout);
console.log('Tipos escritos en src/types/database.types.ts');
