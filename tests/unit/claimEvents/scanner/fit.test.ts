import { describe, expect, it } from 'vitest';
import {
  assessFit,
  guideRectInVideo,
  sideRatio,
  tiltDegrees,
  type Rect,
} from '@/features/claimEvents/utils/scanner/fit';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';

const guide: Rect = { x: 100, y: 100, width: 630, height: 880 };
const rectQuad = (r: Rect, scale = 1): Quad => {
  const w = r.width * Math.sqrt(scale);
  const h = r.height * Math.sqrt(scale);
  const x = r.x + (r.width - w) / 2;
  const y = r.y + (r.height - h) / 2;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
};
const rotate = (quad: Quad, degrees: number): Quad => {
  const a = (degrees * Math.PI) / 180;
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  return quad.map((p) => ({
    x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a),
    y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a),
  })) as Quad;
};

describe('guideRectInVideo (object-fit: cover)', () => {
  it('video más ancho que el visor: recorta a los lados', () => {
    const r = guideRectInVideo(
      { width: 400, height: 400 },
      { x: 100, y: 100, width: 200, height: 200 },
      { width: 1600, height: 800 },
    );
    // escala 0.5; se pierden (800-400)/2 = 200 px de pantalla por lado
    expect(r).toEqual({ x: 600, y: 200, width: 400, height: 400 });
  });
  it('video más alto que el visor: recorta arriba y abajo', () => {
    const r = guideRectInVideo(
      { width: 400, height: 400 },
      { x: 0, y: 0, width: 400, height: 400 },
      { width: 800, height: 1600 },
    );
    expect(r).toEqual({ x: 0, y: 400, width: 800, height: 800 });
  });
  it('misma proporción: solo cambia la escala', () => {
    const r = guideRectInVideo(
      { width: 400, height: 300 },
      { x: 40, y: 30, width: 80, height: 60 },
      { width: 800, height: 600 },
    );
    expect(r).toEqual({ x: 80, y: 60, width: 160, height: 120 });
  });
});

describe('medidas de la pieza', () => {
  it('inclinación respecto del eje más cercano', () => {
    expect(tiltDegrees(rectQuad(guide))).toBeCloseTo(0, 6);
    expect(tiltDegrees(rotate(rectQuad(guide), 10))).toBeCloseTo(10, 4);
    expect(tiltDegrees(rotate(rectQuad(guide), -7))).toBeCloseTo(-7, 4);
    expect(tiltDegrees(rotate(rectQuad(guide), 90))).toBeCloseTo(0, 4); // pieza de lado = también derecha
  });
  it('proporción entre lados opuestos', () => {
    expect(sideRatio(rectQuad(guide))).toBeCloseTo(1, 6);
    const trapezoid: Quad = [
      { x: 20, y: 0 },
      { x: 80, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(sideRatio(trapezoid)).toBeGreaterThan(1.5);
  });
});

describe('assessFit: encaja / acércate / endereza', () => {
  it('sin detección no orienta', () => {
    expect(assessFit(null, guide).state).toBe('none');
  });
  it('encaja cuando ocupa ≥ 80 % del marco y está derecha', () => {
    expect(assessFit(rectQuad(guide, 0.9), guide)).toMatchObject({ state: 'fits' });
    expect(assessFit(rectQuad(guide, 1), guide).state).toBe('fits');
    expect(assessFit(rectQuad(guide, 0.81), guide).state).toBe('fits');
  });
  it('acércate si ocupa menos del 80 %', () => {
    const result = assessFit(rectQuad(guide, 0.6), guide);
    expect(result.state).toBe('closer');
    expect(result.coverage).toBeCloseTo(0.6, 4);
    expect(assessFit(rectQuad(guide, 0.79), guide).state).toBe('closer');
  });
  it('aléjate si se sale del marco', () => {
    expect(assessFit(rectQuad(guide, 1.5), guide).state).toBe('back');
  });
  it('endereza con giro mayor a 6° o perspectiva fuerte', () => {
    expect(assessFit(rotate(rectQuad(guide, 0.95), 12), guide).state).toBe('straighten');
    expect(assessFit(rotate(rectQuad(guide, 0.95), 4), guide).state).toBe('fits');
    const skewed: Quad = [
      { x: guide.x + 60, y: guide.y },
      { x: guide.x + guide.width - 60, y: guide.y },
      { x: guide.x + guide.width, y: guide.y + guide.height },
      { x: guide.x, y: guide.y + guide.height },
    ];
    expect(assessFit(skewed, guide).state).toBe('straighten');
  });
  it('la prioridad es acercarse antes que enderezar', () => {
    expect(assessFit(rotate(rectQuad(guide, 0.5), 15), guide).state).toBe('closer');
  });
});
