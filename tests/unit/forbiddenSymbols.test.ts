// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// docs/spec/auth.md: ningún correo de Supabase Auth. Estos símbolos nunca pueden aparecer en src/.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['resetPasswordForEmail', /resetPasswordForEmail/],
  ['signInWithOtp', /signInWithOtp/],
  ['auth.resend', /auth\s*\.\s*resend\s*\(/],
  ['updateUser({ email })', /updateUser\s*\(\s*\{[^}]*\bemail\b/s],
  ['auth.signUp (cliente)', /auth\s*\.\s*signUp\s*\(/],
  ['inviteUserByEmail', /inviteUserByEmail/],
  ['auth.reauthenticate (envía correo)', /auth\s*\.\s*reauthenticate\s*\(/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('símbolos de Supabase que envían correo', () => {
  const root = join(process.cwd(), 'src');
  const files = sourceFiles(root);

  it('hay código fuente que revisar', () => expect(files.length).toBeGreaterThan(20));

  it.each(FORBIDDEN)('src/ no usa %s', (_name, pattern) => {
    const offenders = files
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
