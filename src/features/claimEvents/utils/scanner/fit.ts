import { polygonArea } from './geometry';
import type { Point, Quad } from './types';

export type Rect = { x: number; y: number; width: number; height: number };

/** Lo que se le dice al vendedor sobre el encuadre. Sin alarmas: solo orientación. */
export type FitState = 'none' | 'closer' | 'back' | 'straighten' | 'fits';

/** La pieza debe ocupar al menos este porcentaje del marco guía. */
export const MIN_GUIDE_COVERAGE = 0.8;
/** Por encima de esto la pieza se sale del marco. */
export const MAX_GUIDE_COVERAGE = 1.2;
/** Giro máximo (grados) respecto de los ejes del marco. */
export const MAX_TILT_DEGREES = 6;
/** Diferencia máxima entre lados opuestos (perspectiva): 1.12 = 12 %. */
export const MAX_SIDE_RATIO = 1.12;

/**
 * Pasa el marco guía (coordenadas del visor) a coordenadas del video, que se muestra con `object-fit: cover`:
 * la imagen se escala hasta cubrir el visor y se recorta de forma centrada.
 */
export function guideRectInVideo(
  viewport: { width: number; height: number },
  guide: Rect,
  video: { width: number; height: number },
): Rect {
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const offsetX = (video.width * scale - viewport.width) / 2;
  const offsetY = (video.height * scale - viewport.height) / 2;
  return {
    x: (guide.x + offsetX) / scale,
    y: (guide.y + offsetY) / scale,
    width: guide.width / scale,
    height: guide.height / scale,
  };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Desviación (−45° a 45°) del lado superior respecto del eje horizontal más cercano. */
export function tiltDegrees(quad: Quad): number {
  const [tl, tr] = quad;
  const angle = (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI;
  return ((((angle + 45) % 90) + 90) % 90) - 45;
}

/** Proporción entre lados opuestos (≥ 1): la perspectiva los vuelve desiguales. */
export function sideRatio(quad: Quad): number {
  const [tl, tr, br, bl] = quad;
  const pair = (a: number, b: number) => Math.max(a, b) / Math.max(1e-9, Math.min(a, b));
  return Math.max(
    pair(distance(tl, tr), distance(bl, br)),
    pair(distance(tl, bl), distance(tr, br)),
  );
}

export type FitAssessment = { state: FitState; coverage: number; tilt: number; skew: number };

/** Compara la pieza detectada con el marco guía: ¿encaja, hay que acercarse o enderezar? */
export function assessFit(quad: Quad | null, guide: Rect): FitAssessment {
  if (!quad) return { state: 'none', coverage: 0, tilt: 0, skew: 1 };
  const coverage = polygonArea(quad) / (guide.width * guide.height);
  const tilt = tiltDegrees(quad);
  const skew = sideRatio(quad);
  let state: FitState = 'fits';
  if (coverage < MIN_GUIDE_COVERAGE) state = 'closer';
  else if (coverage > MAX_GUIDE_COVERAGE) state = 'back';
  else if (Math.abs(tilt) > MAX_TILT_DEGREES || skew > MAX_SIDE_RATIO) state = 'straighten';
  return { state, coverage, tilt, skew };
}
