// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../src/styles/globals.css'), 'utf8');

/** Declaraciones `--x: valor;` de un bloque (el primero que abre con `selector {`). */
function block(selector: string): Record<string, string> {
  const open = css.indexOf(`${selector} {`);
  if (open < 0) throw new Error(`Bloque no encontrado: ${selector}`);
  const close = css.indexOf('\n}', open);
  const decls: Record<string, string> = {};
  for (const m of css.slice(open, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    decls[m[1] as string] = (m[2] as string).trim();
  }
  return decls;
}

const root = block(':root');
const dark = { ...root, ...block("[data-theme='dark']") };

/** Resuelve `var(--x)` encadenados hasta un color hex. */
function resolveToken(name: string, scope: Record<string, string>): string {
  let value = scope[`--${name}`];
  for (let i = 0; i < 8 && value; i++) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    if (!ref) break;
    value = scope[ref];
  }
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Token de color no resoluble a hex: --${name} (${value})`);
  }
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: [string, string][] = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-text', 'color-surface-raised'],
  ['color-text', 'color-surface-overlay'],
  ['color-text-muted', 'color-bg'],
  ['color-text-muted', 'color-surface'],
  ['color-text-muted', 'color-surface-raised'],
  ['color-accent-text', 'color-bg'],
  ['color-accent-text', 'color-surface'],
  ['color-on-accent', 'color-accent'],
  ['color-on-accent', 'color-accent-hover'],
  ['color-on-accent', 'color-accent-pressed'],
  ['color-success', 'color-bg'],
  ['color-warning', 'color-bg'],
  ['color-danger', 'color-bg'],
  ['color-info', 'color-bg'],
  ['color-success', 'color-surface'],
  ['color-warning', 'color-surface'],
  ['color-danger', 'color-surface'],
  ['color-info', 'color-surface'],
];

describe.each([
  ['tema B (marfil)', root],
  ['tema oscuro', dark],
] as const)('tokens de color %s: contraste AA', (_name, scope) => {
  it.each(textPairs)('%s sobre %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(resolveToken(fg, scope), resolveToken(bg, scope))).toBeGreaterThanOrEqual(4.5);
  });

  it('el borde fuerte sobre el fondo ≥ 3:1 (componentes de UI)', () => {
    expect(
      contrast(resolveToken('color-border-strong', scope), resolveToken('color-bg', scope)),
    ).toBeGreaterThanOrEqual(3);
  });

  it('el anillo de foco sobre el fondo ≥ 3:1', () => {
    expect(
      contrast(resolveToken('color-focus-ring', scope), resolveToken('color-bg', scope)),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('identidad Cempasúchil: pares de marca', () => {
  const pairs: [string, string, number][] = [
    ['zl-color-ink', 'zl-color-orange', 8.0],
    ['zl-color-ink', 'zl-color-pink', 5.6],
    ['zl-color-ink', 'zl-color-jade', 10.2],
    ['zl-color-ivory', 'zl-color-bg', 17.5],
    ['zl-color-orange', 'ap-price-bg', 8.0],
    ['ap-fg', 'ap-bg', 17.5],
    ['ap-muted', 'ap-bg', 7.9],
    ['ap-muted', 'ap-s1', 6.0],
    ['ap-edge', 'ap-bg', 3],
    ['zl-color-edge', 'zl-color-bg', 3],
    ['zl-color-muted', 'zl-color-bg', 8.2],
  ];

  it.each(pairs)('%s sobre %s ≥ %f:1', (fg, bg, min) => {
    // Tolerancia de redondeo de la ficha de diseño (una décima).
    expect(contrast(resolveToken(fg, root), resolveToken(bg, root))).toBeGreaterThanOrEqual(
      min - 0.1,
    );
  });

  it('el acento de marca es el naranja Cempasúchil', () => {
    expect(resolveToken('color-accent', root).toLowerCase()).toBe('#ff8a1f');
  });

  it('el texto tinta sobre el estado «vendida» ≥ 4.5:1', () => {
    expect(
      contrast(resolveToken('zl-color-ink', root), resolveToken('zl-state-sold', root)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('respeta prefers-reduced-motion y el interruptor data-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\[data-motion='off'\]/);
  });
});

describe('limpieza de la identidad anterior (S12-15)', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(css|tsx?|svg)$/.test(name) && !name.endsWith('database.types.ts') ? [path] : [];
    });
  }

  const files = sourceFiles(resolve(__dirname, '../../src'));

  it.each([
    ['el dorado #C9A96E', /#c9a96e/i],
    ['--gradient-gold', /--gradient-gold/],
    ['la fuente Inter', /\bInter\b|--font-inter/],
  ])('src/ no contiene %s', (_label, pattern) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
