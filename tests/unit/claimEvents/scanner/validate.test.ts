import { describe, expect, it } from 'vitest';
import {
  MIN_CONFIDENCE,
  detectQuad,
  downscaleRaw,
} from '@/features/claimEvents/utils/scanner/detect';
import {
  CROP_MARGIN,
  expandQuad,
  expandQuadWithin,
  quadSize,
} from '@/features/claimEvents/utils/scanner/geometry';
import { outputGeometry, planDetection } from '@/features/claimEvents/utils/scanner/plan';
import { fitLineRobust, refineQuadByGradient } from '@/features/claimEvents/utils/scanner/refine';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';
import {
  ANGLE_TOLERANCE_DEGREES,
  ASPECT_TOLERANCE,
  interiorAngle,
  quadRatio,
  validateQuad,
} from '@/features/claimEvents/utils/scanner/validate';
import {
  cardQuad,
  glowAround,
  maxCornerError,
  overlayDisc,
  overlayRect,
  renderScene,
  matUnderCards,
  saturatedMat,
} from '../../../helpers/scannerScenes';

const aspect = { width: 63, height: 88 };
const frame = { width: 1000, height: 1400 };
const rect = (w: number, h: number, x = 200, y = 200): Quad => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe('validateQuad (S11-17)', () => {
  it('acepta una pieza 63:88', () => {
    const check = validateQuad(rect(630, 880), aspect, frame);
    expect(check).toMatchObject({ ok: true, problems: [] });
    expect(check.ratio).toBeCloseTo(88 / 63, 5);
  });
  it('acepta la pieza horizontal (orientación indiferente)', () => {
    expect(validateQuad(rect(880, 630, 50, 300), aspect, frame).ok).toBe(true);
  });
  it('tolerancia de aspecto: ±8 % pasa, más no', () => {
    expect(ASPECT_TOLERANCE).toBe(0.08);
    expect(validateQuad(rect(630 * 1.07, 880), aspect, frame).problems).not.toContain('aspect');
    expect(validateQuad(rect(630 * 1.12, 880), aspect, frame).problems).toContain('aspect');
    expect(validateQuad(rect(630 * 0.85, 880), aspect, frame).problems).toContain('aspect');
  });
  it('rechaza un cuadrado o una tira (reflejo, dedo, tapete)', () => {
    expect(validateQuad(rect(700, 700), aspect, frame).problems).toContain('aspect');
    expect(validateQuad(rect(200, 900), aspect, frame).problems).toContain('aspect');
  });
  it('ángulos: un rombo/paralelogramo marcado no es una pieza', () => {
    const skewed: Quad = [
      { x: 400, y: 200 },
      { x: 1030, y: 200 },
      { x: 830, y: 1080 },
      { x: 200, y: 1080 },
    ];
    const check = validateQuad(skewed, aspect, frame);
    expect(check.maxAngleDeviation).toBeGreaterThan(ANGLE_TOLERANCE_DEGREES);
    expect(check.problems).toContain('angles');
  });
  it('mide ángulos interiores y la relación', () => {
    expect(interiorAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 6);
    expect(quadRatio(rect(100, 200))).toBeCloseTo(2, 6);
  });
  it('área mínima y borde del cuadro', () => {
    expect(validateQuad(rect(63, 88), aspect, frame).problems).toContain('small');
    expect(validateQuad(rect(630, 880, 0, 100), aspect, frame).problems).toContain('edge');
    expect(validateQuad(rect(630, 880, 400, 520), aspect, frame).problems).toContain('edge'); // 520+880 > 1400
    // Llena el cuadro (el "fondo" estimado del marco era la propia pieza): también se pide ajuste.
    expect(validateQuad(rect(860, 1270, 70, 60), aspect, frame).problems).toContain('edge');
  });
  it('cuadrilátero cóncavo o cruzado', () => {
    const bow: Quad = [
      { x: 200, y: 200 },
      { x: 830, y: 1080 },
      { x: 830, y: 200 },
      { x: 200, y: 1080 },
    ];
    expect(validateQuad(bow, aspect, frame).problems).toContain('shape');
  });
});

describe('S11-17: una detección dudosa nunca se endereza en silencio', () => {
  const W = 360;
  const H = 480;
  const base = () =>
    renderScene({
      width: W,
      height: H,
      background: 'light',
      quad: cardQuad(W, H, { scale: 0.7, degrees: 3 }),
      noise: 3,
    });

  /** Invariante: o la detección es válida y precisa, o se marca `detected: false` con la causa. */
  function plan(scene: ReturnType<typeof base>) {
    const { image } = downscaleRaw(scene.image, 320);
    const small = { width: image.width, height: image.height };
    const found = detectQuad(image);
    return planDetection(scene.image, found, small, aspect, scene.image);
  }
  const neverDeforms = (p: ReturnType<typeof plan>, scene: ReturnType<typeof base>) => {
    if (p.detected)
      expect(maxCornerError(denorm(p.corners, W, H), scene.truth)).toBeLessThan(
        0.03 * Math.hypot(W, H),
      );
    else expect(p.problems.length).toBeGreaterThan(0);
  };

  it('caso limpio: válido y preciso', () => {
    const scene = base();
    const p = plan(scene);
    expect(p.detected).toBe(true);
    expect(p.problems).toEqual([]);
    expect(maxCornerError(denorm(p.corners, W, H), scene.truth)).toBeLessThan(5);
  });

  it('dedo pegado al borde: o sale preciso o se abre el ajuste, nunca deformado', () => {
    const scene = base();
    const [, tr] = scene.truth;
    overlayDisc(scene.image, tr.x + 28, tr.y + 70, 44, [224, 172, 140]);
    neverDeforms(plan(scene), scene);
  });

  it('sombra proyectada junto a la pieza: el contorno no coincide con un borde real y se abre el ajuste', () => {
    const scene = base();
    const [, , br, bl] = scene.truth;
    overlayRect(scene.image, bl.x - 8, br.y, br.x - bl.x + 70, 62, [20, 20, 22], 0.85);
    const p = plan(scene);
    neverDeforms(p, scene);
    expect(p.detected).toBe(false);
    expect(p.problems).toContain('weak_edges');
  });

  it('reflejo/brillo que ensancha la máscara: nunca "válido" con esquinas lejos de la pieza', () => {
    const scene = base();
    glowAround(scene.image, scene.truth, 14, [235, 235, 230], 0.9);
    neverDeforms(plan(scene), scene);
  });

  it('tapete saturado de fondo: válido y preciso, o se abre el ajuste', () => {
    const scene = base();
    const dark = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: scene.truth,
      noise: 3,
    });
    const onMat = { image: matUnderCards(dark.image), truth: dark.truth };
    neverDeforms(plan(onMat), onMat);
  });

  it('solo tapete (sin pieza): nunca se da por válido', () => {
    const empty = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: [
        { x: -50, y: -50 },
        { x: -40, y: -50 },
        { x: -40, y: -30 },
        { x: -50, y: -30 },
      ],
    });
    saturatedMat(empty.image);
    expect(plan(empty).detected).toBe(false);
  });

  it('la pieza pegada al borde del cuadro (cortada) pide ajuste', () => {
    const scene = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 1.02 }),
    });
    const p = plan(scene);
    expect(p.problems).toContain('edge');
    expect(p.detected).toBe(false);
  });

  it('sin pieza: not_found y recorte centrado de respaldo', () => {
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
    const p = plan(empty);
    expect(p).toMatchObject({ detected: false, problems: ['not_found'] });
  });

  it('confianza baja: low_confidence', () => {
    const scene = base();
    const { image } = downscaleRaw(scene.image, 320);
    const found = detectQuad(image)!;
    const p = planDetection(
      scene.image,
      { ...found, confidence: MIN_CONFIDENCE - 0.1 },
      image,
      aspect,
      scene.image,
    );
    expect(p.detected).toBe(false);
    expect(p.problems).toContain('low_confidence');
  });
});

const denorm = (q: Quad, w: number, h: number): Quad =>
  q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;

describe('afinado por gradiente y ajuste robusto (S11-17)', () => {
  it('fitLineRobust descarta atípicos (un dedo sobre el borde)', () => {
    const points = Array.from({ length: 30 }, (_, i) => ({ x: i * 5, y: 100 }));
    const withOutliers = [...points, { x: 40, y: 140 }, { x: 60, y: 150 }, { x: 80, y: 135 }];
    const fit = fitLineRobust(withOutliers)!;
    expect(fit.inliers.length).toBe(30);
    expect(Math.abs(fit.line.dy)).toBeLessThan(1e-6);
  });

  it('con un halo de luz alrededor, el gradiente acerca las esquinas a la pieza real', () => {
    const W = 600;
    const H = 800;
    const scene = renderScene({
      width: W,
      height: H,
      background: 'dark',
      quad: cardQuad(W, H, { scale: 0.7, degrees: 4 }),
      noise: 2,
    });
    // Halo tenue y ancho: la máscara por color lo toma como pieza, pero el borde real sigue siendo el de mayor gradiente.
    const rough = scene.truth.map((p, i) => {
      const dir = [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ][i]!;
      return { x: p.x + dir.x * 7, y: p.y + dir.y * 7 };
    }) as Quad;
    const before = maxCornerError(rough, scene.truth);
    const { corners, support } = refineQuadByGradient(scene.image, rough);
    expect(maxCornerError(corners, scene.truth)).toBeLessThan(before / 2);
    expect(support.every((n) => n >= 8)).toBe(true);
  });

  it('sin bordes que lo apoyen conserva la recta original', () => {
    const flat = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(120) };
    const quad = rect(60, 80, 20, 10);
    const { corners, support } = refineQuadByGradient(flat, quad);
    expect(support).toEqual([0, 0, 0, 0]);
    corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(quad[i]!.x, 6);
      expect(p.y).toBeCloseTo(quad[i]!.y, 6);
    });
  });
});

describe('margen exterior (S11-18)', () => {
  it('CROP_MARGIN es la única constante (2 % del lado menor por lado)', () => {
    expect(CROP_MARGIN).toBe(0.02);
  });
  it('expande cada lado hacia afuera sin torcer el cuadrilátero', () => {
    const q = rect(630, 880);
    const e = expandQuad(q, 10);
    expect(e[0]).toEqual({ x: 190, y: 190 });
    expect(e[2]).toEqual({ x: 840, y: 1090 });
    expect(quadSize(e)).toEqual({ width: 650, height: 900 });
  });
  it('también con una pieza girada: los lados siguen paralelos', () => {
    const q = cardQuad(1000, 1400, { scale: 0.6, degrees: 20 });
    const e = expandQuad(q, 12);
    const dir = (a: Quad, i: number) =>
      Math.atan2(a[(i + 1) % 4]!.y - a[i]!.y, a[(i + 1) % 4]!.x - a[i]!.x);
    for (let i = 0; i < 4; i += 1) expect(dir(e, i)).toBeCloseTo(dir(q, i), 6);
  });
  it('margen 0 devuelve el mismo cuadrilátero', () => {
    const q = rect(100, 100);
    expect(expandQuad(q, 0)).toBe(q);
  });
  it('con margen completo cuando cabe: 2 % del lado menor', () => {
    const { quad, margin } = expandQuadWithin(rect(630, 880), 1000, 1400);
    expect(margin).toBeCloseTo(0.02 * 630, 6);
    expect(quadSize(quad).width).toBeCloseTo(630 + 2 * margin, 4);
  });
  it('pieza al borde de la foto: el margen se reduce, sin deformar (esquinas dentro y forma conservada)', () => {
    const q = rect(630, 880, 0, 100); // pegada al borde izquierdo
    const { quad, margin } = expandQuadWithin(q, 1000, 1400);
    expect(margin).toBeLessThan(0.02 * 630);
    expect(margin).toBeLessThanOrEqual(1e-3); // sin espacio a la izquierda: margen ~0
    quad.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    });
    expect(quadSize(quad).height / quadSize(quad).width).toBeCloseTo(880 / 630, 1);
  });
  it('esquina libre en un lado y pegada en otro: margen parcial y formas paralelas', () => {
    const q = rect(630, 880, 5, 300);
    const { quad, margin } = expandQuadWithin(q, 1000, 1400);
    expect(margin).toBeCloseTo(5, 1);
    expect(quad[0]!.x).toBeCloseTo(0, 1);
  });
});

describe('geometría de salida (S11-18)', () => {
  const sample = { width: 1000, height: 1400 };
  it('incluye el margen y respeta el tope de 1600 px', () => {
    const g = outputGeometry(rect(630, 880), sample, aspect, 4, 1600);
    expect(Math.max(g.width, g.height)).toBe(1600); // fuente grande (×4): se topa en 1600
    expect(g.width / g.height).toBeCloseTo((630 + 2 * g.margin) / (880 + 2 * g.margin), 2);
  });
  it('no agranda más de lo que la fuente dio', () => {
    const g = outputGeometry(rect(630, 880), sample, aspect, 0.5, 1600);
    expect(Math.max(g.width, g.height)).toBe(Math.round(g.cropLongSide));
    expect(g.cropLongSide).toBeCloseTo((880 + 2 * g.margin) * 0.5, 4);
  });
  it('no fuerza 63:88: la salida sigue la forma del cuadrilátero', () => {
    const g = outputGeometry(rect(700, 880), sample, aspect, 2, 1600);
    expect(g.width / g.height).toBeCloseTo((700 + 2 * g.margin) / (880 + 2 * g.margin), 2);
    expect(g.width / g.height).not.toBeCloseTo(63 / 88, 2);
  });
  it('una pieza horizontal se orienta a vertical antes de calcular', () => {
    const g = outputGeometry(rect(880, 630, 50, 300), sample, aspect, 2, 1600);
    expect(g.height).toBeGreaterThan(g.width);
  });
  it('el lado mayor llega a 1000 px con una fuente suficiente', () => {
    const g = outputGeometry(rect(630, 880), sample, aspect, 1.3, 1600);
    expect(Math.max(g.width, g.height)).toBeGreaterThanOrEqual(1000);
  });
});

describe('orientación (solo varias piezas)', () => {
  it('dos piezas verticales pegadas miden casi como una horizontal: se exige la orientación de la categoría', () => {
    const wide = { width: 2000, height: 1400 };
    const fused = rect(1260, 880); // 2 × 630 de ancho, 880 de alto → 1.43, casi 88:63
    expect(validateQuad(fused, aspect, wide).ok).toBe(true); // una sola pieza: se acepta horizontal
    expect(validateQuad(fused, aspect, wide, { matchOrientation: true }).problems).toContain(
      'orientation',
    );
    expect(validateQuad(rect(630, 880), aspect, wide, { matchOrientation: true }).ok).toBe(true);
  });
});
