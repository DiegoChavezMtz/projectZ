import type { Point, Quad, RawImage } from './types';

export type Line = { point: Point; dx: number; dy: number };

/** Recta de mínimos cuadrados totales (PCA) por los puntos. */
export function fitLine(points: readonly Point[]): Line | null {
  if (points.length < 2) return null;
  const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const my = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { point: { x: mx, y: my }, dx: Math.cos(angle), dy: Math.sin(angle) };
}

/** Distancia perpendicular de un punto a la recta. */
export const distanceToLine = (line: Line, p: Point) =>
  Math.abs(-(p.x - line.point.x) * line.dy + (p.y - line.point.y) * line.dx);

/**
 * Ajuste de recta que descarta valores atípicos (reflejos, sombras, un dedo sobre el borde): se reajusta quitando
 * los puntos cuyo residuo supera `k` veces la mediana de residuos, hasta estabilizarse. Devuelve también cuántos
 * puntos quedaron.
 */
export function fitLineRobust(
  points: readonly Point[],
  options: { rounds?: number; k?: number; minResidual?: number } = {},
): { line: Line; inliers: Point[] } | null {
  const { rounds = 4, k = 2.5, minResidual = 0.75 } = options;
  let inliers = [...points];
  let line = fitLine(inliers);
  if (!line) return null;
  for (let round = 0; round < rounds; round += 1) {
    const residuals = inliers.map((p) => distanceToLine(line as Line, p));
    const sorted = [...residuals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const limit = Math.max(minResidual, k * median);
    const kept = inliers.filter((_, i) => (residuals[i] as number) <= limit);
    if (kept.length === inliers.length || kept.length < 3) break;
    inliers = kept;
    line = fitLine(inliers) as Line;
  }
  return { line, inliers };
}

export function intersectLines(l1: Line, l2: Line): Point | null {
  const det = l1.dx * l2.dy - l1.dy * l2.dx;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((l2.point.x - l1.point.x) * l2.dy - (l2.point.y - l1.point.y) * l2.dx) / det;
  return { x: l1.point.x + t * l1.dx, y: l1.point.y + t * l1.dy };
}

function luminanceAt(image: RawImage, x: number, y: number): number {
  const cx = Math.min(image.width - 1, Math.max(0, x));
  const cy = Math.min(image.height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const lum = (xx: number, yy: number) => {
    const i = (yy * image.width + xx) * 4;
    return 0.299 * (image.data[i] as number) + 0.587 * (image.data[i + 1] as number) + 0.114 * (image.data[i + 2] as number);
  };
  return (
    lum(x0, y0) * (1 - fx) * (1 - fy) + lum(x1, y0) * fx * (1 - fy) + lum(x0, y1) * (1 - fx) * fy + lum(x1, y1) * fx * fy
  );
}

/** Fracción mínima de muestras de cada lado que deben encontrar un borde para fiarse del contorno. */
export const EDGE_SUPPORT_RATIO = 0.6;

export type GradientRefineOptions = {
  /** Mitad del ancho de búsqueda, como fracción del lado menor de la pieza. */
  searchFraction?: number;
  samples?: number;
  /** Gradiente mínimo (niveles de luminancia por píxel) para considerar que hay un borde. */
  minGradient?: number;
  /** Puntos de borde válidos mínimos por lado para fiarse del ajuste. */
  minSupport?: number;
};

/**
 * Afina cada lado del cuadrilátero con el gradiente de la imagen (el borde real de la pieza) en lugar de la máscara
 * por color de fondo, que un reflejo o una sombra pegados a la pieza ensanchan o recortan. En cada lado se buscan,
 * a lo largo de la normal, los puntos de mayor gradiente; la recta se ajusta descartando atípicos; las esquinas son
 * las intersecciones. Si un lado no tiene apoyo suficiente se conserva su recta original.
 */
export function refineQuadByGradient(
  image: RawImage,
  quad: Quad,
  options: GradientRefineOptions = {},
): { corners: Quad; support: number[]; samples: number } {
  const { searchFraction = 0.04, samples = 28, minGradient = 10, minSupport = 8 } = options;
  const side = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const shortSide = Math.min(
    (side(quad[0], quad[1]) + side(quad[3], quad[2])) / 2,
    (side(quad[0], quad[3]) + side(quad[1], quad[2])) / 2,
  );
  const search = Math.max(3, shortSide * searchFraction);

  const lines: (Line | null)[] = [];
  const support: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i] as Point;
    const b = quad[(i + 1) % 4] as Point;
    const length = side(a, b);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    const nx = uy; // normal hacia afuera (el cuadrilátero está en sentido horario, con Y hacia abajo)
    const ny = -ux;
    const points: Point[] = [];
    for (let k = 1; k <= samples; k += 1) {
      const t = 0.1 + (0.8 * k) / (samples + 1);
      const px = a.x + ux * length * t;
      const py = a.y + uy * length * t;
      let best = 0;
      let bestAt = 0;
      for (let s = -search; s <= search; s += 0.5) {
        const g = Math.abs(
          luminanceAt(image, px + nx * (s + 1), py + ny * (s + 1)) - luminanceAt(image, px + nx * (s - 1), py + ny * (s - 1)),
        );
        if (g > best) {
          best = g;
          bestAt = s;
        }
      }
      if (best >= minGradient * 2) points.push({ x: px + nx * bestAt, y: py + ny * bestAt });
    }
    const fit = points.length >= minSupport ? fitLineRobust(points) : null;
    const usable = fit && fit.inliers.length >= minSupport ? fit : null;
    support.push(usable ? usable.inliers.length : 0);
    lines.push(usable ? usable.line : { point: a, dx: ux, dy: uy });
  }

  const corners = quad.map((corner, i) => {
    const previous = lines[(i + 3) % 4] as Line;
    const current = lines[i] as Line;
    const point = intersectLines(previous, current);
    return point && Math.hypot(point.x - corner.x, point.y - corner.y) <= search * 3 ? point : corner;
  }) as Quad;
  return { corners, support, samples };
}
