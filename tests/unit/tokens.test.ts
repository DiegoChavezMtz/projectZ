// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../src/styles/globals.css'), 'utf8');

function token(name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
  if (!value) throw new Error(`Token de color no encontrado: --${name}`);
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

describe('tokens de color: contraste AA', () => {
  const normalText: [string, string][] = [
    ['color-text', 'color-bg'],
    ['color-text', 'color-surface'],
    ['color-text', 'color-surface-raised'],
    ['color-text', 'color-surface-overlay'],
    ['color-text-muted', 'color-bg'],
    ['color-text-muted', 'color-surface'],
    ['color-text-muted', 'color-surface-raised'],
    ['color-accent', 'color-bg'],
    ['color-accent', 'color-surface'],
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

  it.each(normalText)('%s sobre %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('el borde fuerte sobre el fondo ≥ 3:1 (componentes de UI)', () => {
    expect(contrast(token('color-border-strong'), token('color-bg'))).toBeGreaterThanOrEqual(3);
  });

  it('el acento de marca es #C9A96E', () => {
    expect(token('color-accent').toLowerCase()).toBe('#c9a96e');
  });

  it('respeta prefers-reduced-motion globalmente', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
