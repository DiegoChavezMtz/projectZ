import { describe, expect, it } from 'vitest';
import { downscaleRaw } from '@/features/claimEvents/utils/scanner/detect';
import {
  MAX_PIECES,
  detectPieces,
  manualPieceQuad,
  sortReadingOrder,
} from '@/features/claimEvents/utils/scanner/multi';
import { planPieces } from '@/features/claimEvents/utils/scanner/plan';
import { scaleQuad } from '@/features/claimEvents/utils/scanner/geometry';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';
import {
  cardQuad,
  gridQuads,
  maxCornerError,
  renderCards,
  renderScene,
  saturatedMat,
} from '../../../helpers/scannerScenes';

const aspect = { width: 63, height: 88 };
const W = 640;
const H = 640;

function run(quads: Quad[], background: 'dark' | 'light' | 'wood' | 'green' = 'dark', noise = 4) {
  const { image, truths } = renderCards({ width: W, height: H, quads, background, noise });
  const { image: small } = downscaleRaw(image, 320);
  return { image, small, truths, found: detectPieces(small, aspect) };
}
const factor = W / 320;

describe('detectPieces: varias piezas (S11-19)', () => {
  for (const [cols, rows] of [
    [2, 1],
    [3, 1],
    [2, 2],
    [3, 2],
    [3, 3],
  ] as const) {
    it(`${cols * rows} piezas sobre fondo liso → ${cols * rows} detecciones válidas, en orden de lectura`, () => {
      const quads = gridQuads(W, H, cols, rows, { gap: 26 });
      const { found, truths } = run(quads);
      expect(found.pieces).toHaveLength(cols * rows);
      expect(found.warnings).toEqual([]);
      found.pieces.forEach((piece, i) => {
        expect(piece.valid).toBe(true);
        expect(maxCornerError(scaleQuad(piece.corners, factor), truths[i]!)).toBeLessThan(8);
      });
    });
  }

  for (const background of ['light', 'wood', 'green'] as const)
    it(`6 piezas sobre fondo ${background}`, () => {
      const { found } = run(gridQuads(W, H, 3, 2, { gap: 26 }), background);
      expect(found.pieces.filter((p) => p.valid)).toHaveLength(6);
    });

  it('piezas levemente desalineadas se ordenan por filas y luego de izquierda a derecha', () => {
    const quads = gridQuads(W, H, 3, 2, { gap: 26, jitter: 4 });
    const { found, truths } = run(quads);
    expect(found.pieces).toHaveLength(6);
    found.pieces.forEach((piece, i) =>
      expect(maxCornerError(scaleQuad(piece.corners, factor), truths[i]!)).toBeLessThan(12),
    );
  });

  it('piezas que se tocan: avisa y no inventa cortes', () => {
    const quads = gridQuads(W, H, 2, 1, { gap: 0 });
    const { found } = run(quads);
    expect(found.warnings).toContain('touching');
    // Una sola componente fusionada e inválida (no se corta por la mitad).
    expect(found.pieces).toHaveLength(1);
    expect(found.pieces[0]!.valid).toBe(false);
  });

  it('una pieza suelta y dos pegadas: la suelta es válida y se avisa de las otras', () => {
    const [a, b, c] = gridQuads(W, H, 3, 1, { gap: 0 });
    const separated: Quad[] = [a!, b!, c!.map((p) => ({ x: p.x + 20, y: p.y })) as Quad];
    const { found } = run(separated);
    expect(found.warnings).toContain('touching');
    expect(found.pieces.some((p) => p.valid)).toBe(true);
    expect(found.pieces.some((p) => !p.valid)).toBe(true);
  });

  it('sin piezas: none_found', () => {
    const { found } = run(
      [
        [
          { x: -50, y: -50 },
          { x: -40, y: -50 },
          { x: -40, y: -30 },
          { x: -50, y: -30 },
        ],
      ],
      'wood',
    );
    expect(found.pieces).toEqual([]);
    expect(found.warnings).toEqual(['none_found']);
  });

  it('ignora manchas diminutas (polvo, un tornillo)', () => {
    const quads = gridQuads(W, H, 2, 1, { gap: 40 });
    const speck: Quad = [
      { x: 10, y: 10 },
      { x: 22, y: 10 },
      { x: 22, y: 22 },
      { x: 10, y: 22 },
    ];
    const { found } = run([...quads, speck]);
    expect(found.pieces).toHaveLength(2);
  });

  it(`tope de ${MAX_PIECES} piezas: se conservan las más grandes y se avisa`, () => {
    const quads = gridQuads(W * 2, H * 2, 5, 3, { cell: 160, gap: 18 }); // 15 piezas
    const { image } = renderCards({ width: W * 2, height: H * 2, quads, background: 'dark' });
    const { image: small } = downscaleRaw(image, 400);
    const found = detectPieces(small, aspect);
    expect(found.pieces).toHaveLength(MAX_PIECES);
    expect(found.warnings).toContain('too_many');
  });

  it('fondo con textura (tapete saturado): no inventa piezas válidas', () => {
    const { image, truths } = renderCards({
      width: W,
      height: H,
      quads: gridQuads(W, H, 3, 2, { gap: 26 }),
      background: 'dark',
    });
    saturatedMat(image);
    const { image: small } = downscaleRaw(image, 320);
    const found = detectPieces(small, aspect);
    void truths;
    // Todo lo que se devuelve como válido debe coincidir con una pieza real; lo dudoso se marca inválido.
    for (const piece of found.pieces.filter((p) => p.valid))
      expect(truths.some((t) => maxCornerError(scaleQuad(piece.corners, factor), t) < 15)).toBe(
        true,
      );
  });

  it('una sola pieza: sigue funcionando', () => {
    const scene = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 0.7 }),
    });
    const { image: small } = downscaleRaw(scene.image, 320);
    const found = detectPieces(small, aspect);
    expect(found.pieces).toHaveLength(1);
    expect(found.pieces[0]!.valid).toBe(true);
  });
});

describe('sortReadingOrder', () => {
  const at = (x: number, y: number): { corners: Quad } => ({
    corners: [
      { x, y },
      { x: x + 50, y },
      { x: x + 50, y: y + 70 },
      { x, y: y + 70 },
    ],
  });
  it('filas de arriba abajo y columnas de izquierda a derecha', () => {
    const shuffled = [
      at(200, 100),
      at(10, 10),
      at(10, 100),
      at(200, 10),
      at(100, 100),
      at(100, 10),
    ];
    const order = sortReadingOrder(shuffled).map((p) => `${p.corners[0].x},${p.corners[0].y}`);
    expect(order).toEqual(['10,10', '100,10', '200,10', '10,100', '100,100', '200,100']);
  });
  it('tolera una fila ligeramente inclinada', () => {
    const items = [at(200, 24), at(10, 0), at(100, 12)];
    expect(sortReadingOrder(items).map((p) => p.corners[0].x)).toEqual([10, 100, 200]);
  });
  it('lista vacía o de una', () => {
    expect(sortReadingOrder([])).toEqual([]);
    expect(sortReadingOrder([at(1, 1)])).toHaveLength(1);
  });
});

describe('planPieces: misma validación que una sola pieza (S11-17)', () => {
  it('6 piezas válidas con esquinas normalizadas y sin avisos', () => {
    const { image } = renderCards({
      width: W,
      height: H,
      quads: gridQuads(W, H, 3, 2, { gap: 26 }),
      background: 'dark',
    });
    const { image: small } = downscaleRaw(image, 320);
    const plan = planPieces(image, small, aspect);
    expect(plan.pieces).toHaveLength(6);
    expect(plan.pieces.every((p) => p.valid && p.problems.length === 0)).toBe(true);
    expect(plan.warnings).toEqual([]);
    for (const piece of plan.pieces)
      for (const c of piece.corners) {
        expect(c.x).toBeGreaterThan(0);
        expect(c.x).toBeLessThan(1);
      }
  });
  it('las piezas pegadas se marcan inválidas', () => {
    const { image } = renderCards({
      width: W,
      height: H,
      quads: gridQuads(W, H, 2, 1, { gap: 0 }),
      background: 'dark',
    });
    const { image: small } = downscaleRaw(image, 320);
    const plan = planPieces(image, small, aspect);
    expect(plan.pieces.some((p) => !p.valid)).toBe(true);
    expect(plan.warnings).toContain('touching');
  });
});

describe('manualPieceQuad', () => {
  it('es un recorte centrado con la relación de la categoría', () => {
    const q = manualPieceQuad({ width: 1000, height: 1400 }, aspect);
    expect(q[0].x).toBeLessThan(q[1].x);
    expect(q[0].y).toBeLessThan(q[3].y);
  });
});
