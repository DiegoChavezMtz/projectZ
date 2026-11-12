import { describe, expect, it } from 'vitest';
import {
  detectQuad,
  downscaleRaw,
  MIN_CONFIDENCE,
} from '@/features/claimEvents/utils/scanner/detect';
import {
  centeredCropQuad,
  orientQuad,
  quadSize,
  scaleQuad,
  targetSize,
} from '@/features/claimEvents/utils/scanner/geometry';
import { warpPerspective } from '@/features/claimEvents/utils/scanner/warp';
import {
  cardQuad,
  maxCornerError,
  renderScene,
  type Background,
} from '../../../helpers/scannerScenes';

const W = 320;
const H = 426;
const backgrounds: Background[] = ['dark', 'light', 'wood', 'green'];

describe('detección de contorno (escenas sintéticas)', () => {
  for (const background of backgrounds) {
    it(`encuentra la pieza sobre fondo ${background} girada y en perspectiva`, () => {
      const scene = renderScene({
        width: W,
        height: H,
        background,
        quad: cardQuad(W, H, { scale: 0.7, degrees: 8, tilt: 0.06 }),
      });
      const found = detectQuad(scene.image);
      expect(found).not.toBeNull();
      expect(found!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
      expect(maxCornerError(found!.corners, scene.truth)).toBeLessThan(5);
    });
  }

  it('detecta una pieza girada 35°', () => {
    const scene = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 0.62, degrees: 35 }),
    });
    const found = detectQuad(scene.image);
    expect(found).not.toBeNull();
    expect(maxCornerError(found!.corners, scene.truth)).toBeLessThan(6);
  });

  it('devuelve null si solo hay fondo', () => {
    const empty = renderScene({
      width: W,
      height: H,
      background: 'wood',
      quad: [
        { x: -50, y: -50 },
        { x: -40, y: -50 },
        { x: -40, y: -30 },
        { x: -50, y: -30 },
      ],
    });
    expect(detectQuad(empty.image)).toBeNull();
  });

  it('devuelve null si la pieza es diminuta', () => {
    const tiny = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 0.15 }),
    });
    expect(detectQuad(tiny.image)).toBeNull();
  });

  it('reduce la imagen conservando la proporción', () => {
    const big = renderScene({
      width: 800,
      height: 1066,
      background: 'dark',
      quad: cardQuad(800, 1066),
    });
    const { image, factor } = downscaleRaw(big.image, 320);
    expect(Math.max(image.width, image.height)).toBe(320);
    expect(factor).toBeCloseTo(1066 / 320, 5);
    const found = detectQuad(image)!;
    expect(maxCornerError(scaleQuad(found.corners, factor), big.truth)).toBeLessThan(14);
  });

  it('no reduce si ya cabe', () => {
    const small = renderScene({
      width: 100,
      height: 100,
      background: 'dark',
      quad: cardQuad(100, 100),
    });
    expect(downscaleRaw(small.image, 320).factor).toBe(1);
  });
});

describe('recorte con corrección de perspectiva', () => {
  it('endereza la pieza a la relación de aspecto de la categoría', () => {
    const scene = renderScene({
      width: W,
      height: H,
      background: 'wood',
      quad: cardQuad(W, H, { degrees: 10, tilt: 0.08 }),
    });
    const found = detectQuad(scene.image)!;
    const aspect = { width: 63, height: 88 };
    const { width, height } = targetSize(aspect, 400);
    const out = warpPerspective(scene.image, orientQuad(found.corners, aspect), width, height)!;
    expect(out.width / out.height).toBeCloseTo(63 / 88, 2);
    // El marco amarillo queda pegado al borde y el centro es "arte": no queda fondo en las esquinas.
    const px = (x: number, y: number) =>
      out.data.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 3);
    const corner = px(6, 6);
    expect(corner[0]).toBeGreaterThan(180); // amarillo del marco
    expect(corner[2]).toBeLessThan(120);
  });

  it('una foto horizontal sale vertical', () => {
    const wide = renderScene({
      width: 426,
      height: 320,
      background: 'dark',
      quad: cardQuad(426, 320, { scale: 0.7, degrees: 90 }),
    });
    const found = detectQuad(wide.image)!;
    const oriented = orientQuad(found.corners, { width: 63, height: 88 });
    expect(quadSize(oriented).height).toBeGreaterThan(quadSize(oriented).width);
  });

  it('el recorte centrado de respaldo funciona sin detección', () => {
    const scene = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 0.8 }),
    });
    const quad = centeredCropQuad(W, H, { width: 63, height: 88 });
    const { width, height } = targetSize({ width: 63, height: 88 }, 200);
    expect(warpPerspective(scene.image, quad, width, height)).not.toBeNull();
  });

  it('devuelve null con un cuadrilátero degenerado', () => {
    const scene = renderScene({
      width: 50,
      height: 50,
      background: 'dark',
      quad: cardQuad(50, 50),
    });
    const p = { x: 5, y: 5 };
    expect(warpPerspective(scene.image, [p, p, p, p], 10, 10)).toBeNull();
  });
});
