// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const fixturesDir = resolve(__dirname, '../../tools/boundary-fixtures');

const eslintBin = resolve(__dirname, '../../node_modules/.bin/eslint');

type LintResult = { filePath: string; messages: { ruleId: string | null; fatal?: boolean }[] };

// Se corre como proceso para que el resolver de alias (@/ → src/) use el tsconfig de los fixtures.
function lintFixtures(): LintResult[] {
  const run = spawnSync(eslintBin, ['src', '--format', 'json'], {
    cwd: fixturesDir,
    encoding: 'utf8',
  });
  return JSON.parse(run.stdout) as LintResult[];
}

describe('lint de fronteras (tools/boundary-fixtures)', () => {
  it('cada fixture produce exactamente la regla que declara en "// expect:"', () => {
    const results = lintFixtures();
    const checked: string[] = [];

    for (const result of results) {
      const source = readFileSync(result.filePath, 'utf8');
      const expected = /\/\/ expect: (\S+)/.exec(source)?.[1];
      if (!expected) continue;
      checked.push(result.filePath);

      const rules = new Set(result.messages.map((m) => m.ruleId));
      const fatal = result.messages.filter((m) => m.fatal);
      expect(fatal, result.filePath).toEqual([]);

      if (expected === 'none') {
        expect(result.messages, result.filePath).toEqual([]);
      } else {
        expect(
          rules.has(expected),
          `${result.filePath} debía fallar con ${expected}; obtuvo ${[...rules].join(',')}`,
        ).toBe(true);
      }
    }

    expect(checked.length).toBeGreaterThanOrEqual(10);
  }, 60_000);
});
