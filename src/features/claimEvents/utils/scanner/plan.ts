import { MIN_CONFIDENCE } from './detect';
import { detectPieces, type MultiWarning } from './multi';
import {
  centeredCropQuad,
  clampQuad,
  denormalizeQuad,
  expandQuadWithin,
  normalizeQuad,
  orientQuad,
  quadSize,
} from './geometry';
import { EDGE_SUPPORT_RATIO, refineQuadByGradient } from './refine';
import type { Aspect, Detection, Quad, RawImage } from './types';
import { validateQuad, type QuadProblem } from './validate';

/** `weak_edges`: algún lado del contorno no coincide con un borde real de la imagen (sombra, reflejo, tapete). */
export type DetectionProblem = QuadProblem | 'not_found' | 'low_confidence' | 'weak_edges';

export type DetectionPlan = {
  /** Esquinas (normalizadas) que se proponen: la pieza detectada o, si no hay, un recorte centrado de respaldo. */
  corners: Quad;
  /** Verdadero solo si la pieza se detectó con confianza Y el cuadrilátero pasó la validación (S11-17). */
  detected: boolean;
  confidence: number;
  problems: DetectionProblem[];
};

/**
 * S11-17: decide si la detección es utilizable. Afina los lados con el gradiente de la imagen y valida que el
 * cuadrilátero parezca una pieza (relación de aspecto, ángulos, tamaño, sin tocar el borde). Si no pasa, NO se
 * endereza: se propone el cuadrilátero (o el recorte centrado) para que el vendedor lo ajuste a la vista.
 */
export function planDetection(
  sample: RawImage,
  found: Detection | null,
  small: { width: number; height: number },
  aspect: Aspect,
  frame: { width: number; height: number },
): DetectionPlan {
  const fallback = normalizeQuad(centeredCropQuad(frame.width, frame.height, aspect), frame.width, frame.height);
  if (!found) return { corners: fallback, detected: false, confidence: 0, problems: ['not_found'] };

  // De la imagen reducida a la muestra, y de ahí al afinado por gradiente.
  const roughNormalized = normalizeQuad(found.corners, small.width, small.height);
  const rough = denormalizeQuad(roughNormalized, sample.width, sample.height);
  const gradient = refineQuadByGradient(sample, rough);
  const refined = gradient.corners;
  const edgesOk = Math.min(...gradient.support) >= Math.ceil(gradient.samples * EDGE_SUPPORT_RATIO);

  const check = (quad: Quad) => validateQuad(quad, aspect, sample);
  const refinedCheck = check(refined);
  const roughCheck = check(rough);
  // El gradiente puede equivocarse (un reflejo fuerte pegado al borde): si empeora, se conserva la máscara.
  const useRefined = refinedCheck.ok || !roughCheck.ok;
  const quad = useRefined ? refined : rough;
  const verdict = useRefined ? refinedCheck : roughCheck;
  const corners = normalizeQuad(quad, sample.width, sample.height);

  const problems: DetectionProblem[] = [...verdict.problems];
  if (!edgesOk) problems.push('weak_edges');
  if (found.confidence < MIN_CONFIDENCE) problems.unshift('low_confidence');
  return { corners, detected: problems.length === 0, confidence: found.confidence, problems };
}

export type OutputGeometry = {
  /** Cuadrilátero final en píxeles de la muestra: orientado y con el margen exterior (`CROP_MARGIN`). */
  quad: Quad;
  width: number;
  height: number;
  /** Margen realmente aplicado, en píxeles de la muestra. */
  margin: number;
  /** Lado mayor (px de la foto original) de la región recortada, margen incluido. */
  cropLongSide: number;
};

/**
 * S11-18: del cuadrilátero elegido a la geometría de salida. Se orienta a la categoría, se le suma el margen
 * exterior (sin salirse de la foto y sin deformar) y el tamaño sale de la forma real del cuadrilátero: no se
 * fuerza la relación 63:88. El lado mayor no se agranda más de lo que la fuente dio y respeta `maxSide`.
 */
export function outputGeometry(
  quad: Quad,
  sample: { width: number; height: number },
  aspect: Aspect,
  scaleToOriginal: number,
  maxSide: number,
): OutputGeometry {
  const oriented = orientQuad(clampQuad(quad, sample.width, sample.height), aspect);
  const { quad: expanded, margin } = expandQuadWithin(oriented, sample.width, sample.height);
  const size = quadSize(expanded);
  const cropLongSide = Math.max(size.width, size.height) * scaleToOriginal;
  const outLong = Math.max(1, Math.min(maxSide, Math.round(cropLongSide)));
  const scale = outLong / Math.max(size.width, size.height, 1e-9);
  return {
    quad: expanded,
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
    margin,
    cropLongSide,
  };
}

export type PiecePlan = {
  /** Esquinas normalizadas (0 a 1) respecto de la foto. */
  corners: Quad;
  /** Pasó la validación (aspecto, ángulos, tamaño) y sus lados coinciden con bordes reales. */
  valid: boolean;
  confidence: number;
  problems: DetectionProblem[];
};

export type MultiPlan = {
  pieces: PiecePlan[];
  warnings: MultiWarning[];
};

/**
 * S11-19: detecta todas las piezas y a cada una le aplica lo mismo que a una sola: afinado por gradiente y
 * validación (S11-17). Las piezas se devuelven en orden de lectura y con esquinas normalizadas.
 */
export function planPieces(
  sample: RawImage,
  small: RawImage,
  aspect: Aspect,
  options: { maxPieces?: number } = {},
): MultiPlan {
  const found = detectPieces(small, aspect, options);
  const pieces: PiecePlan[] = found.pieces.map((piece) => {
    const rough = denormalizeQuad(normalizeQuad(piece.corners, small.width, small.height), sample.width, sample.height);
    const gradient = refineQuadByGradient(sample, rough);
    const refinedCheck = validateQuad(gradient.corners, aspect, sample, { minAreaFraction: 0.01, matchOrientation: true });
    const roughCheck = validateQuad(rough, aspect, sample, { minAreaFraction: 0.01, matchOrientation: true });
    const useRefined = refinedCheck.ok || !roughCheck.ok;
    const quad = useRefined ? gradient.corners : rough;
    const verdict = useRefined ? refinedCheck : roughCheck;
    const edgesOk = Math.min(...gradient.support) >= Math.ceil(gradient.samples * EDGE_SUPPORT_RATIO);
    const problems: DetectionProblem[] = [...verdict.problems];
    if (!edgesOk) problems.push('weak_edges');
    if (piece.confidence < MIN_CONFIDENCE) problems.unshift('low_confidence');
    return {
      corners: normalizeQuad(quad, sample.width, sample.height),
      valid: problems.length === 0,
      confidence: piece.confidence,
      problems,
    };
  });
  const warnings = [...found.warnings];
  // La validación fina (gradiente) pudo invalidar piezas que la máscara daba por buenas.
  if (pieces.some((p) => !p.valid) && !warnings.includes('touching')) warnings.push('touching');
  return { pieces, warnings };
}
