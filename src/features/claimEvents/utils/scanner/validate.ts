import { isConvexQuad, polygonArea } from './geometry';
import type { Aspect, Point, Quad } from './types';

// S11-17: un cuadrilátero solo se endereza (perspectiva) si parece de verdad una pieza. Si es un reflejo, una
// sombra, un dedo o parte del tapete, estirarlo a la relación de la categoría produce una imagen torcida: en ese
// caso no se aplica la perspectiva y se abre el ajuste de recorte.

/** Diferencia máxima entre la relación (lado largo / lado corto) del cuadrilátero y la de la categoría. */
export const ASPECT_TOLERANCE = 0.08;
/** Desviación máxima (grados) de cada ángulo interior respecto de 90°. */
export const ANGLE_TOLERANCE_DEGREES = 12;
/** Área mínima de la pieza como fracción del cuadro (una sola pieza). */
export const MIN_AREA_FRACTION = 0.1;
/** Distancia mínima de una esquina al borde del cuadro, como fracción del lado menor: tocarlo = pieza cortada. */
export const EDGE_TOUCH_FRACTION = 0.01;

/**
 * Si el contorno cubre casi todo el cuadro (cada lado a menos de esta fracción del lado menor del borde), la pieza
 * llena la foto: el color de fondo que se estima del marco exterior es en realidad el de la pieza y el contorno
 * encontrado es solo su arte interior. Se trata como `edge`: hay que alejarse o ajustar a mano.
 */
export const FRAME_FILL_FRACTION = 0.08;

/**
 * `orientation`: la pieza está girada respecto de la categoría (solo se exige en varias piezas: dos piezas verticales
 * que se tocan miden casi lo mismo que una horizontal, y no hay forma de distinguirlas por la silueta).
 */
export type QuadProblem = 'aspect' | 'angles' | 'small' | 'edge' | 'shape' | 'orientation';

export type QuadCheck = {
  ok: boolean;
  problems: QuadProblem[];
  /** Relación lado largo / lado corto medida. */
  ratio: number;
  /** Mayor desviación de un ángulo interior respecto de 90°. */
  maxAngleDeviation: number;
};

export type ValidateOptions = {
  aspectTolerance?: number;
  angleTolerance?: number;
  minAreaFraction?: number;
  /** Exige la misma orientación (vertical/horizontal) que la categoría. */
  matchOrientation?: boolean;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ángulo interior (grados) en `b` del trío a-b-c. */
export function interiorAngle(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / Math.max(1e-9, Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Relación lado largo / lado corto con el promedio de lados opuestos (orientación indiferente). */
export function quadRatio(quad: Quad): number {
  const [tl, tr, br, bl] = quad;
  const width = (distance(tl, tr) + distance(bl, br)) / 2;
  const height = (distance(tl, bl) + distance(tr, br)) / 2;
  return Math.max(width, height) / Math.max(1e-9, Math.min(width, height));
}

/** ¿El cuadrilátero se parece a una pieza de la categoría? Ver constantes arriba. */
export function validateQuad(
  quad: Quad,
  aspect: Aspect,
  frame: { width: number; height: number },
  options: ValidateOptions = {},
): QuadCheck {
  const aspectTolerance = options.aspectTolerance ?? ASPECT_TOLERANCE;
  const angleTolerance = options.angleTolerance ?? ANGLE_TOLERANCE_DEGREES;
  const minArea = options.minAreaFraction ?? MIN_AREA_FRACTION;
  const problems: QuadProblem[] = [];

  if (!isConvexQuad(quad)) problems.push('shape');

  const target = Math.max(aspect.width, aspect.height) / Math.min(aspect.width, aspect.height);
  const ratio = quadRatio(quad);
  if (Math.abs(ratio / target - 1) > aspectTolerance) problems.push('aspect');
  if (options.matchOrientation) {
    const [tl, tr, br, bl] = quad;
    const wide = (distance(tl, tr) + distance(bl, br)) / 2 > (distance(tl, bl) + distance(tr, br)) / 2;
    if (wide !== aspect.width > aspect.height) problems.push('orientation');
  }

  let maxAngleDeviation = 0;
  for (let i = 0; i < 4; i += 1) {
    const angle = interiorAngle(quad[(i + 3) % 4] as Point, quad[i] as Point, quad[(i + 1) % 4] as Point);
    maxAngleDeviation = Math.max(maxAngleDeviation, Math.abs(angle - 90));
  }
  if (maxAngleDeviation > angleTolerance) problems.push('angles');

  if (polygonArea(quad) / (frame.width * frame.height) < minArea) problems.push('small');

  const edge = Math.min(frame.width, frame.height) * EDGE_TOUCH_FRACTION;
  const touches = quad.some(
    (p) => p.x <= edge || p.y <= edge || p.x >= frame.width - edge || p.y >= frame.height - edge,
  );
  const fill = Math.min(frame.width, frame.height) * FRAME_FILL_FRACTION;
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const fillsFrame =
    Math.min(...xs) < fill &&
    Math.max(...xs) > frame.width - fill &&
    Math.min(...ys) < fill &&
    Math.max(...ys) > frame.height - fill;
  if (touches || fillsFrame) problems.push('edge');

  return { ok: problems.length === 0, problems, ratio, maxAngleDeviation };
}
