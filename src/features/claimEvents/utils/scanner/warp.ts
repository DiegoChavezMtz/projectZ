import { solveHomography, applyHomography } from './geometry';
import type { Quad, RawImage } from './types';

/**
 * Corrección de perspectiva: lleva el cuadrilátero `quad` de la imagen a un rectángulo `width × height`.
 * Muestreo bilineal con la homografía inversa (salida → origen).
 */
export function warpPerspective(
  source: RawImage,
  quad: Quad,
  width: number,
  height: number,
): RawImage | null {
  const rectangle: Quad = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const h = solveHomography(rectangle, quad);
  if (!h) return null;
  const out = new Uint8ClampedArray(width * height * 4);
  const maxX = source.width - 1;
  const maxY = source.height - 1;
  const { data } = source;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = applyHomography(h, x + 0.5, y + 0.5);
      const sx = Math.min(maxX, Math.max(0, p.x - 0.5));
      const sy = Math.min(maxY, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * source.width + x0) * 4;
      const i10 = (y0 * source.width + x1) * 4;
      const i01 = (y1 * source.width + x0) * 4;
      const i11 = (y1 * source.width + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const top = (data[i00 + c] as number) * (1 - fx) + (data[i10 + c] as number) * fx;
        const bottom = (data[i01 + c] as number) * (1 - fx) + (data[i11 + c] as number) * fx;
        out[o + c] = top * (1 - fy) + bottom * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { width, height, data: out };
}
