import { describe, expect, it } from 'vitest';
import {
  applyHomography,
  centeredCropQuad,
  clampQuad,
  denormalizeQuad,
  isConvexQuad,
  normalizeQuad,
  orderCorners,
  orientQuad,
  polygonArea,
  quadSize,
  scaleQuad,
  solveHomography,
  targetSize,
} from '@/features/claimEvents/utils/scanner/geometry';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';

const rect: Quad = [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 160 },
  { x: 10, y: 160 },
];

describe('orderCorners', () => {
  it('deja igual un orden correcto', () => {
    expect(orderCorners(rect)).toEqual(rect);
  });
  it('ordena esquinas desordenadas en todas las permutaciones', () => {
    const [tl, tr, br, bl] = rect;
    const perms = [
      [br, tl, bl, tr],
      [bl, br, tr, tl],
      [tr, bl, tl, br],
      [tl, br, tr, bl],
    ];
    for (const p of perms) expect(orderCorners(p as Quad)).toEqual(rect);
  });
  it('ordena un cuadrilátero girado 30° y una perspectiva fuerte', () => {
    const skew: Quad = [
      { x: 40, y: 10 },
      { x: 200, y: 30 },
      { x: 230, y: 250 },
      { x: 10, y: 220 },
    ];
    expect(orderCorners([skew[2], skew[0], skew[3], skew[1]] as Quad)).toEqual(skew);
  });
  it('exige 4 puntos', () => {
    expect(() => orderCorners(rect.slice(0, 3))).toThrow(RangeError);
  });
});

describe('tamaño y orientación', () => {
  it('mide ancho y alto promedio', () => {
    expect(quadSize(rect)).toEqual({ width: 100, height: 140 });
  });
  it('gira el orden cuando la foto es horizontal y el objetivo vertical', () => {
    const wide: Quad = [
      { x: 0, y: 0 },
      { x: 140, y: 0 },
      { x: 140, y: 100 },
      { x: 0, y: 100 },
    ];
    const oriented = orientQuad(wide, { width: 63, height: 88 });
    const size = quadSize(oriented);
    expect(size.height).toBeGreaterThan(size.width);
  });
  it('no toca un cuadrilátero ya orientado ni uno de categoría horizontal', () => {
    expect(orientQuad(rect, { width: 63, height: 88 })).toBe(rect);
    const wide: Quad = [rect[3], rect[0], rect[1], rect[2]];
    expect(orientQuad(wide, { width: 88, height: 63 })).toBe(wide);
  });
  it('calcula el tamaño de salida por categoría', () => {
    expect(targetSize({ width: 63, height: 88 }, 1600)).toEqual({ width: 1145, height: 1600 });
    expect(targetSize({ width: 88, height: 63 }, 1600)).toEqual({ width: 1600, height: 1145 });
    expect(targetSize({ width: 1, height: 1 }, 800)).toEqual({ width: 800, height: 800 });
    expect(() => targetSize({ width: 0, height: 1 }, 100)).toThrow(RangeError);
  });
});

describe('centeredCropQuad', () => {
  it('foto vertical: recorte centrado con la relación de la categoría', () => {
    const q = centeredCropQuad(900, 1600, { width: 63, height: 88 });
    const { width, height } = quadSize(q);
    expect(width / height).toBeCloseTo(63 / 88, 5);
    expect((q[0].x + q[1].x) / 2).toBeCloseTo(450, 5);
    expect((q[0].y + q[3].y) / 2).toBeCloseTo(800, 5);
  });
  it('foto horizontal: la pieza sigue horizontal y cabe en la imagen', () => {
    const q = centeredCropQuad(1600, 900, { width: 63, height: 88 });
    const { width, height } = quadSize(q);
    expect(width / height).toBeCloseTo(88 / 63, 5);
    for (const p of q) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(900);
    }
  });
  it('categoría con otra relación de aspecto', () => {
    const q = centeredCropQuad(1000, 1000, { width: 1, height: 1 });
    expect(quadSize(q).width).toBeCloseTo(quadSize(q).height, 5);
  });
});

describe('normalización y límites', () => {
  it('escala, normaliza y denormaliza', () => {
    expect(scaleQuad(rect, 2)[2]).toEqual({ x: 220, y: 320 });
    denormalizeQuad(normalizeQuad(rect, 200, 400), 200, 400).forEach((p, i) => {
      expect(p.x).toBeCloseTo(rect[i]!.x, 9);
      expect(p.y).toBeCloseTo(rect[i]!.y, 9);
    });
  });
  it('limita al interior de la imagen', () => {
    const out = clampQuad(
      [
        { x: -5, y: -5 },
        { x: 300, y: 0 },
        { x: 300, y: 500 },
        { x: 0, y: 500 },
      ],
      200,
      400,
    );
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[2]).toEqual({ x: 200, y: 400 });
  });
  it('calcula área y convexidad', () => {
    expect(polygonArea(rect)).toBe(14000);
    expect(isConvexQuad(rect)).toBe(true);
    const bowtie: Quad = [rect[0], rect[2], rect[1], rect[3]];
    expect(isConvexQuad(bowtie)).toBe(false);
    const collinear: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(isConvexQuad(collinear)).toBe(false);
  });
});

describe('homografía', () => {
  it('lleva cada esquina a su destino', () => {
    const to: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 140 },
      { x: 0, y: 140 },
    ];
    const skew: Quad = [
      { x: 40, y: 10 },
      { x: 200, y: 30 },
      { x: 230, y: 250 },
      { x: 10, y: 220 },
    ];
    const h = solveHomography(skew, to);
    expect(h).not.toBeNull();
    skew.forEach((p, i) => {
      const r = applyHomography(h as number[], p.x, p.y);
      expect(r.x).toBeCloseTo(to[i]!.x, 6);
      expect(r.y).toBeCloseTo(to[i]!.y, 6);
    });
  });
  it('identidad cuando origen y destino coinciden', () => {
    const h = solveHomography(rect, rect) as number[];
    const r = applyHomography(h, 55, 77);
    expect(r.x).toBeCloseTo(55, 6);
    expect(r.y).toBeCloseTo(77, 6);
  });
  it('devuelve null con puntos degenerados', () => {
    const same: Quad = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(solveHomography(same, rect)).toBeNull();
  });
});
