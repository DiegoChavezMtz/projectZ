import { MIN_CONFIDENCE, convexHull, foregroundMask, refineCorners, simplifyToQuad } from './detect';
import { centeredCropQuad, isConvexQuad, orderCorners, polygonArea } from './geometry';
import type { Aspect, Point, Quad, RawImage } from './types';
import { validateQuad, type QuadProblem } from './validate';

// S11-19: varias piezas por foto. Con un fondo liso y las piezas sin tocarse, cada pieza es una componente conexa
// de la máscara de primer plano; cada una pasa por la misma validación que el modo de una pieza (S11-17).

/** Tope de piezas por foto. */
export const MAX_PIECES = 12;
/** Área mínima de una pieza como fracción del cuadro: por debajo es ruido, polvo o un dedo. */
export const MIN_PIECE_AREA_FRACTION = 0.012;
/** Si el primer plano ocupa más de esto del cuadro, el fondo no es liso (o llena todo). */
export const ROUGH_BACKGROUND_FRACTION = 0.72;

export type PieceCandidate = {
  /** Esquinas en píxeles de la imagen analizada. */
  corners: Quad;
  confidence: number;
  area: number;
  valid: boolean;
  problems: QuadProblem[];
};

export type MultiWarning =
  /** No se encontró ninguna pieza. */
  | 'none_found'
  /** Alguna detección no parece una pieza (piezas que se tocan, sombras, fondo con textura). */
  | 'touching'
  /** El fondo no es liso. */
  | 'rough_background'
  /** Había más de `MAX_PIECES`: se conservaron las más grandes. */
  | 'too_many';

export type MultiDetection = { pieces: PieceCandidate[]; warnings: MultiWarning[] };

type Component = { area: number; boundary: Point[] };

/** Todas las componentes conexas (4 vecinos) de la máscara, con su área y sus píxeles de borde. */
function labelComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const label = new Int32Array(mask.length);
  const stack: number[] = [];
  const areas: number[] = [0];
  let next = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || label[start] !== 0) continue;
    next += 1;
    let area = 0;
    stack.push(start);
    label[start] = next;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      area += 1;
      const x = index % width;
      const y = (index - x) / width;
      const visit = (neighbor: number) => {
        if (mask[neighbor] === 1 && label[neighbor] === 0) {
          label[neighbor] = next;
          stack.push(neighbor);
        }
      };
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    areas.push(area);
  }
  const components: Component[] = areas.map((area) => ({ area, boundary: [] }));
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const own = label[index] as number;
      if (own === 0) continue;
      const edge =
        x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
        label[index - 1] !== own || label[index + 1] !== own ||
        label[index - width] !== own || label[index + width] !== own;
      if (edge) components[own]?.boundary.push({ x: x + 0.5, y: y + 0.5 });
    }
  return components.slice(1);
}

const centroid = (quad: Quad): Point => ({
  x: quad.reduce((s, p) => s + p.x, 0) / 4,
  y: quad.reduce((s, p) => s + p.y, 0) / 4,
});

/**
 * Orden de lectura: de arriba abajo por filas y de izquierda a derecha dentro de cada fila. Una fila nueva empieza
 * cuando el centro de la pieza queda más abajo que la mitad de la altura mediana de las piezas.
 */
export function sortReadingOrder<T extends { corners: Quad }>(items: readonly T[]): T[] {
  if (items.length < 2) return [...items];
  const heights = items.map((item) => {
    const ys = item.corners.map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  });
  const median = [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 0;
  const byY = [...items].sort((a, b) => centroid(a.corners).y - centroid(b.corners).y);
  const rows: T[][] = [];
  let anchor = -Infinity;
  for (const item of byY) {
    const y = centroid(item.corners).y;
    if (rows.length === 0 || y - anchor > median / 2) {
      rows.push([item]);
      anchor = y;
    } else {
      (rows[rows.length - 1] as T[]).push(item);
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => centroid(a.corners).x - centroid(b.corners).x));
}

/**
 * Detecta todas las piezas de la foto. Cada componente grande se reduce a un cuadrilátero, se afina y se valida
 * como en el modo de una pieza. Las que no pasan se devuelven igual (`valid: false`) para que el vendedor las
 * revise: no se inventan cortes, ni se unen o separan piezas.
 */
export function detectPieces(
  image: RawImage,
  aspect: Aspect,
  options: { maxPieces?: number; minAreaFraction?: number } = {},
): MultiDetection {
  const maxPieces = options.maxPieces ?? MAX_PIECES;
  const minAreaFraction = options.minAreaFraction ?? MIN_PIECE_AREA_FRACTION;
  const warnings: MultiWarning[] = [];
  const mask = foregroundMask(image);
  if (!mask) return { pieces: [], warnings: ['none_found'] };

  const frameArea = image.width * image.height;
  let foreground = 0;
  for (const bit of mask) foreground += bit;
  const components = labelComponents(mask, image.width, image.height)
    .filter((c) => c.area >= frameArea * minAreaFraction)
    .sort((a, b) => b.area - a.area);
  if (components.length === 0) return { pieces: [], warnings: ['none_found'] };
  if (components.length > maxPieces) warnings.push('too_many');

  const candidates: PieceCandidate[] = [];
  for (const component of components.slice(0, maxPieces)) {
    const hull = convexHull(component.boundary);
    const simplified = simplifyToQuad(hull);
    if (!simplified) continue;
    const ordered = orderCorners(simplified);
    if (!isConvexQuad(ordered)) continue;
    const corners = refineCorners(ordered, component.boundary);
    const quadArea = polygonArea(corners);
    const fill = Math.min(1, component.area / Math.max(1e-9, quadArea));
    const hullArea = polygonArea(hull);
    const hullFit = hullArea === 0 ? 0 : Math.min(quadArea, hullArea) / Math.max(quadArea, hullArea);
    const confidence = Math.max(0, Math.min(1, fill * hullFit));
    const check = validateQuad(corners, aspect, image, { minAreaFraction, matchOrientation: true });
    const problems = [...check.problems];
    candidates.push({
      corners,
      confidence,
      area: component.area,
      valid: check.ok && confidence >= MIN_CONFIDENCE,
      problems,
    });
  }

  if (foreground / frameArea > ROUGH_BACKGROUND_FRACTION) warnings.push('rough_background');
  if (candidates.some((c) => !c.valid)) warnings.push('touching');
  return { pieces: sortReadingOrder(candidates), warnings };
}

/** Esquinas de una pieza añadida a mano: un recorte centrado y pequeño, para que se arrastre a su lugar. */
export function manualPieceQuad(frame: { width: number; height: number }, aspect: Aspect): Quad {
  return centeredCropQuad(frame.width, frame.height, aspect, 0.3);
}
