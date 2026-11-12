import { applyHomography, solveHomography } from '@/features/claimEvents/utils/scanner/geometry';
import type { Point, Quad, RawImage } from '@/features/claimEvents/utils/scanner/types';

// Escenas sintéticas para probar la detección: una "pieza" con arte y marco sobre distintos fondos,
// vista en perspectiva, con ruido. Generador determinista (semilla fija).

export type Background = 'dark' | 'light' | 'wood' | 'green';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function backgroundPixel(
  kind: Background,
  x: number,
  y: number,
  noise: number,
): [number, number, number] {
  switch (kind) {
    case 'dark':
      return [28 + noise, 30 + noise, 34 + noise];
    case 'light':
      return [226 + noise, 224 + noise, 218 + noise];
    case 'green':
      return [34 + noise, 92 + noise, 58 + noise];
    case 'wood': {
      const grain = Math.sin(y * 0.35 + Math.sin(x * 0.05) * 3) * 12;
      return [150 + grain + noise, 104 + grain + noise, 62 + grain * 0.6 + noise];
    }
  }
}

/** Textura de la pieza en coordenadas (u, v) ∈ [0,1]²: marco amarillo y arte con degradado. */
function cardPixel(u: number, v: number): [number, number, number] {
  const frame = 0.06;
  if (u < frame || u > 1 - frame || v < frame || v > 1 - frame) return [214, 186, 70];
  const t = (u + v) / 2;
  return [60 + 160 * t, 90 + 80 * (1 - t), 180 - 100 * t];
}

export type Scene = { image: RawImage; truth: Quad };

/** `truth` son las esquinas reales de la pieza (sup. izq., sup. der., inf. der., inf. inf. izq.) en píxeles. */
export function renderScene(opts: {
  width: number;
  height: number;
  quad: Quad;
  background: Background;
  noise?: number;
  seed?: number;
}): Scene {
  const { width, height, quad, background } = opts;
  const rand = rng(opts.seed ?? 7);
  const noiseAmp = opts.noise ?? 6;
  const unit: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const h = solveHomography(quad, unit);
  if (!h) throw new Error('Escena degenerada');
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const noise = (rand() - 0.5) * 2 * noiseAmp;
      const { x: u, y: v } = applyHomography(h, x + 0.5, y + 0.5);
      const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
      const [r, g, b] = inside ? cardPixel(u, v) : backgroundPixel(background, x, y, noise);
      const o = (y * width + x) * 4;
      data[o] = r + (inside ? noise : 0);
      data[o + 1] = g + (inside ? noise : 0);
      data[o + 2] = b + (inside ? noise : 0);
      data[o + 3] = 255;
    }
  return { image: { width, height, data }, truth: quad };
}

/** Pieza vertical 63:88 centrada, girada `degrees` y con inclinación (perspectiva) `tilt` (0 a ~0.2). */
export function cardQuad(
  width: number,
  height: number,
  opts: { scale?: number; degrees?: number; tilt?: number } = {},
): Quad {
  const scale = opts.scale ?? 0.7;
  const cardH = height * scale;
  const cardW = cardH * (63 / 88);
  const angle = ((opts.degrees ?? 0) * Math.PI) / 180;
  const tilt = opts.tilt ?? 0;
  const cx = width / 2;
  const cy = height / 2;
  const base: Point[] = [
    { x: (-cardW / 2) * (1 - tilt), y: -cardH / 2 },
    { x: (cardW / 2) * (1 - tilt), y: -cardH / 2 },
    { x: (cardW / 2) * (1 + tilt), y: cardH / 2 },
    { x: (-cardW / 2) * (1 + tilt), y: cardH / 2 },
  ];
  return base.map((p) => ({
    x: cx + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: cy + p.x * Math.sin(angle) + p.y * Math.cos(angle),
  })) as Quad;
}

/** Error máximo (px) entre dos cuadriláteros ordenados. */
export const maxCornerError = (a: Quad, b: Quad): number =>
  Math.max(...a.map((p, i) => Math.hypot(p.x - (b[i] as Point).x, p.y - (b[i] as Point).y)));
