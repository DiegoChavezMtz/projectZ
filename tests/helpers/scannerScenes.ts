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

// --- Casos difíciles (S11-17) ----------------------------------------------------------------------

type Rgb = [number, number, number];

/** Mezcla un rectángulo de color sobre la imagen (alfa 0 a 1). */
export function overlayRect(
  image: RawImage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
  alpha = 1,
) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(image.height, Math.ceil(y + h)); yy += 1)
    for (
      let xx = Math.max(0, Math.floor(x));
      xx < Math.min(image.width, Math.ceil(x + w));
      xx += 1
    ) {
      const o = (yy * image.width + xx) * 4;
      for (let c = 0; c < 3; c += 1)
        image.data[o + c] = (image.data[o + c] as number) * (1 - alpha) + color[c]! * alpha;
    }
}

/** Mancha circular (dedo, reflejo) con alfa constante. */
export function overlayDisc(
  image: RawImage,
  cx: number,
  cy: number,
  r: number,
  color: Rgb,
  alpha = 1,
) {
  for (
    let y = Math.max(0, Math.floor(cy - r));
    y < Math.min(image.height, Math.ceil(cy + r));
    y += 1
  )
    for (
      let x = Math.max(0, Math.floor(cx - r));
      x < Math.min(image.width, Math.ceil(cx + r));
      x += 1
    )
      if (Math.hypot(x - cx, y - cy) <= r) {
        const o = (y * image.width + x) * 4;
        for (let c = 0; c < 3; c += 1)
          image.data[o + c] = (image.data[o + c] as number) * (1 - alpha) + color[c]! * alpha;
      }
}

/** Fondo de tapete saturado: franjas de colores vivos (rojo/azul) en lugar de un color liso. */
export function saturatedMat(image: RawImage) {
  for (let y = 0; y < image.height; y += 1)
    for (let x = 0; x < image.width; x += 1) {
      const o = (y * image.width + x) * 4;
      const stripe = Math.floor(x / 14 + y / 14) % 2 === 0;
      image.data[o] = stripe ? 200 : 30;
      image.data[o + 1] = 30;
      image.data[o + 2] = stripe ? 40 : 190;
    }
}

/** Halo luminoso suave alrededor de un cuadrilátero (reflejo/brillo): ensancha la máscara por color. */
export function glowAround(image: RawImage, quad: Quad, spread: number, color: Rgb, alpha: number) {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  const [tl, tr, , bl] = quad;
  const halfW = Math.hypot(tr.x - tl.x, tr.y - tl.y) / 2 + spread;
  const halfH = Math.hypot(bl.x - tl.x, bl.y - tl.y) / 2 + spread;
  const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  for (let y = 0; y < image.height; y += 1)
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const u = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle));
      const v = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (u <= halfW && v <= halfH) {
        const o = (y * image.width + x) * 4;
        for (let c = 0; c < 3; c += 1)
          image.data[o + c] = (image.data[o + c] as number) * (1 - alpha) + color[c]! * alpha;
      }
    }
}

// --- Varias piezas (S11-19) ----------------------------------------------------------------------------

/** Escena con varias piezas sobre un mismo fondo. */
export function renderCards(opts: {
  width: number;
  height: number;
  quads: Quad[];
  background: Background;
  noise?: number;
  seed?: number;
}): { image: RawImage; truths: Quad[] } {
  const { width, height, quads, background } = opts;
  const rand = rng(opts.seed ?? 11);
  const noiseAmp = opts.noise ?? 4;
  const unit: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const homographies = quads.map((q) => {
    const h = solveHomography(q, unit);
    if (!h) throw new Error('Escena degenerada');
    return h;
  });
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const noise = (rand() - 0.5) * 2 * noiseAmp;
      let color: [number, number, number] | null = null;
      for (const h of homographies) {
        const { x: u, y: v } = applyHomography(h, x + 0.5, y + 0.5);
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          const [r, g, b] = cardPixel(u, v);
          color = [r + noise, g + noise, b + noise];
          break;
        }
      }
      const [r, g, b] = color ?? backgroundPixel(background, x, y, noise);
      const o = (y * width + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  return { image: { width, height, data }, truths: quads };
}

/** Cuadrícula de `cols × rows` piezas 63:88 con separación `gap` (px), centrada. Pieza = `cell` px de ancho. */
export function gridQuads(
  width: number,
  height: number,
  cols: number,
  rows: number,
  opts: { cell?: number; gap?: number; jitter?: number } = {},
): Quad[] {
  const cell =
    opts.cell ??
    Math.min(
      (width * 0.86) / cols - (opts.gap ?? 20),
      ((height * 0.86) / rows - (opts.gap ?? 20)) * (63 / 88),
    );
  const cellH = cell * (88 / 63);
  const gap = opts.gap ?? 20;
  const totalW = cols * cell + (cols - 1) * gap;
  const totalH = rows * cellH + (rows - 1) * gap;
  const x0 = (width - totalW) / 2;
  const y0 = (height - totalH) / 2;
  const quads: Quad[] = [];
  for (let r = 0; r < rows; r += 1)
    for (let c = 0; c < cols; c += 1) {
      const j = ((r * 7 + c * 3) % 5) - 2; // leve variación determinista
      const x = x0 + c * (cell + gap) + j * (opts.jitter ?? 0);
      const y = y0 + r * (cellH + gap) - j * (opts.jitter ?? 0);
      quads.push([
        { x, y },
        { x: x + cell, y },
        { x: x + cell, y: y + cellH },
        { x, y: y + cellH },
      ]);
    }
  return quads;
}

/** Cambia el fondo oscuro de una escena por un tapete saturado, conservando las piezas (píxeles claros). */
export function matUnderCards(image: RawImage): RawImage {
  const mat: RawImage = { ...image, data: new Uint8ClampedArray(image.data) };
  saturatedMat(mat);
  const out = new Uint8ClampedArray(image.data);
  for (let i = 0; i < out.length; i += 4) {
    const isBackground =
      (image.data[i] as number) + (image.data[i + 1] as number) + (image.data[i + 2] as number) <
      160;
    if (isBackground) for (let c = 0; c < 3; c += 1) out[i + c] = mat.data[i + c] as number;
  }
  return { ...image, data: out };
}
