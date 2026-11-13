import type { Aspect, Point, Quad } from './types';

/** Ordena cuatro puntos como [sup. izq., sup. der., inf. der., inf. izq.] por ángulo alrededor del centro. */
export function orderCorners(points: readonly Point[]): Quad {
  if (points.length !== 4) throw new RangeError('Se necesitan exactamente 4 esquinas');
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  const sorted = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  // Con el eje Y hacia abajo el ángulo crece en sentido horario; se arranca en la esquina más cercana a (0, 0).
  let start = 0;
  let best = Infinity;
  sorted.forEach((p, index) => {
    const score = p.x + p.y;
    if (score < best) {
      best = score;
      start = index;
    }
  });
  const rotated = [0, 1, 2, 3].map((i) => sorted[(start + i) % 4] as Point);
  return rotated as Quad;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ancho y alto promedio de un cuadrilátero ya ordenado. */
export function quadSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  return {
    width: (distance(tl, tr) + distance(bl, br)) / 2,
    height: (distance(tl, bl) + distance(tr, br)) / 2,
  };
}

/** Si el cuadrilátero es apaisado y el objetivo vertical (o al revés), gira el orden 90° para no deformar. */
export function orientQuad(quad: Quad, aspect: Aspect): Quad {
  const { width, height } = quadSize(quad);
  const quadIsWide = width > height;
  const aspectIsWide = aspect.width > aspect.height;
  if (quadIsWide === aspectIsWide) return quad;
  const [tl, tr, br, bl] = quad;
  return [bl, tl, tr, br];
}

/** Tamaño de salida con la relación de aspecto de la categoría y el lado mayor en `maxSide`. */
export function targetSize(aspect: Aspect, maxSide: number): { width: number; height: number } {
  if (aspect.width <= 0 || aspect.height <= 0 || maxSide <= 0)
    throw new RangeError('Relación de aspecto o tamaño inválidos');
  const scale = maxSide / Math.max(aspect.width, aspect.height);
  return {
    width: Math.max(1, Math.round(aspect.width * scale)),
    height: Math.max(1, Math.round(aspect.height * scale)),
  };
}

/**
 * Recorte de respaldo cuando no hay detección: el rectángulo más grande con la relación de aspecto de la
 * categoría, centrado y con un margen. Sigue la orientación de la foto (vertical u horizontal).
 */
export function centeredCropQuad(
  imageWidth: number,
  imageHeight: number,
  aspect: Aspect,
  margin = 0.06,
): Quad {
  if (imageWidth <= 0 || imageHeight <= 0) throw new RangeError('Dimensiones inválidas');
  const photoIsWide = imageWidth > imageHeight;
  const aspectIsWide = aspect.width > aspect.height;
  const ratio =
    photoIsWide === aspectIsWide ? aspect.width / aspect.height : aspect.height / aspect.width;
  const availableW = imageWidth * (1 - margin * 2);
  const availableH = imageHeight * (1 - margin * 2);
  let width = availableW;
  let height = width / ratio;
  if (height > availableH) {
    height = availableH;
    width = height * ratio;
  }
  const left = (imageWidth - width) / 2;
  const top = (imageHeight - height) / 2;
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
}

/** Multiplica las coordenadas (por ejemplo, de la imagen reducida a la original). */
export const scaleQuad = (quad: Quad, factor: number): Quad =>
  quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad;

/** Normaliza (0 a 1) respecto de las dimensiones de la imagen, para guardarlas sin depender de la resolución. */
export const normalizeQuad = (quad: Quad, width: number, height: number): Quad =>
  quad.map((p) => ({ x: p.x / width, y: p.y / height })) as Quad;

export const denormalizeQuad = (quad: Quad, width: number, height: number): Quad =>
  quad.map((p) => ({ x: p.x * width, y: p.y * height })) as Quad;

/** Limita las esquinas al interior de la imagen. */
export const clampQuad = (quad: Quad, width: number, height: number): Quad =>
  quad.map((p) => ({
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  })) as Quad;

/** Área por la fórmula del cordón (shoelace). */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] as Point;
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
}

/** ¿El cuadrilátero es convexo y no degenerado? */
export function isConvexQuad(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i] as Point;
    const b = quad[(i + 1) % 4] as Point;
    const c = quad[(i + 2) % 4] as Point;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const current = Math.sign(cross);
    if (sign !== 0 && current !== sign) return false;
    sign = current;
  }
  return true;
}

/** Homografía 3×3 (aplanada, h33 = 1) que lleva `from[i]` a `to[i]`. Devuelve null si es singular. */
export function solveHomography(from: Quad, to: Quad): number[] | null {
  const matrix: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i] as Point;
    const { x: u, y: v } = to[i] as Point;
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Eliminación gaussiana con pivoteo parcial sobre la matriz aumentada 8×9.
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 8; row += 1)
      if (
        Math.abs((matrix[row] as number[])[col] as number) >
        Math.abs((matrix[pivot] as number[])[col] as number)
      )
        pivot = row;
    const pivotRow = matrix[pivot] as number[];
    if (Math.abs(pivotRow[col] as number) < 1e-10) return null;
    matrix[pivot] = matrix[col] as number[];
    matrix[col] = pivotRow;
    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue;
      const current = matrix[row] as number[];
      const factor = (current[col] as number) / (pivotRow[col] as number);
      if (factor === 0) continue;
      for (let k = col; k < 9; k += 1)
        current[k] = (current[k] as number) - factor * (pivotRow[k] as number);
    }
  }
  const h = matrix.map((row, i) => (row[8] as number) / (row[i] as number));
  return [...h, 1];
}

export function applyHomography(h: readonly number[], x: number, y: number): Point {
  const w = (h[6] as number) * x + (h[7] as number) * y + (h[8] as number);
  return {
    x: ((h[0] as number) * x + (h[1] as number) * y + (h[2] as number)) / w,
    y: ((h[3] as number) * x + (h[4] as number) * y + (h[5] as number)) / w,
  };
}

/** Margen exterior alrededor de la pieza validada, como fracción del lado menor, por lado (S11-18). */
export const CROP_MARGIN = 0.02;

/** Separa cada lado del cuadrilátero `margin` píxeles hacia afuera y vuelve a intersectar los lados contiguos. */
export function expandQuad(quad: Quad, margin: number): Quad {
  if (margin === 0) return quad;
  const lines = [0, 1, 2, 3].map((i) => {
    const a = quad[i] as Point;
    const b = quad[(i + 1) % 4] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / length;
    const dy = (b.y - a.y) / length;
    return { point: { x: a.x + dy * margin, y: a.y - dx * margin }, dx, dy };
  });
  return quad.map((corner, i) => {
    const l1 = lines[(i + 3) % 4] as (typeof lines)[number];
    const l2 = lines[i] as (typeof lines)[number];
    const det = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(det) < 1e-9) return corner;
    const t = ((l2.point.x - l1.point.x) * l2.dy - (l2.point.y - l1.point.y) * l2.dx) / det;
    return { x: l1.point.x + t * l1.dx, y: l1.point.y + t * l1.dy };
  }) as Quad;
}

const inside = (quad: Quad, width: number, height: number) =>
  quad.every((p) => p.x >= -1e-6 && p.y >= -1e-6 && p.x <= width + 1e-6 && p.y <= height + 1e-6);

/**
 * Cuadrilátero con el margen exterior `CROP_MARGIN` (del lado menor, por lado). Si con el margen completo alguna
 * esquina se saldría de la foto, el margen se reduce (nunca se desplazan las esquinas por separado), así que la
 * forma no se deforma: una pieza pegada al borde de la foto simplemente tiene menos margen.
 */
export function expandQuadWithin(
  quad: Quad,
  width: number,
  height: number,
  fraction = CROP_MARGIN,
): { quad: Quad; margin: number } {
  const shortSide = Math.min(quadSize(quad).width, quadSize(quad).height);
  const full = shortSide * fraction;
  if (full <= 0) return { quad, margin: 0 };
  const expanded = expandQuad(quad, full);
  if (inside(expanded, width, height)) return { quad: expanded, margin: full };
  let low = 0;
  let high = full;
  for (let i = 0; i < 12; i += 1) {
    const mid = (low + high) / 2;
    if (inside(expandQuad(quad, mid), width, height)) low = mid;
    else high = mid;
  }
  return { quad: expandQuad(quad, low), margin: low };
}
