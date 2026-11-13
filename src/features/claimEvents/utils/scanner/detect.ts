import { isConvexQuad, orderCorners, polygonArea } from './geometry';
import { fitLineRobust, intersectLines, type Line } from './refine';
import type { Detection, Point, Quad, RawImage } from './types';

/** Lado mayor con el que se analiza la foto: suficiente para el contorno y barato en un celular de gama media. */
export const DETECT_MAX_SIDE = 320;
/** Por debajo de este valor no se confía en la detección y se ofrece el recorte manual. */
export const MIN_CONFIDENCE = 0.8;

/** Reduce por promedio de cajas (para pruebas y para entornos sin canvas). */
export function downscaleRaw(
  source: RawImage,
  maxSide: number,
): { image: RawImage; factor: number } {
  const longest = Math.max(source.width, source.height);
  if (longest <= maxSide) return { image: source, factor: 1 };
  const factor = longest / maxSide;
  const width = Math.max(1, Math.round(source.width / factor));
  const height = Math.max(1, Math.round(source.height / factor));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * factor);
    const y1 = Math.min(source.height, Math.max(y0 + 1, Math.floor((y + 1) * factor)));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * factor);
      const x1 = Math.min(source.width, Math.max(x0 + 1, Math.floor((x + 1) * factor)));
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy += 1)
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * source.width + xx) * 4;
          r += source.data[i] as number;
          g += source.data[i + 1] as number;
          b += source.data[i + 2] as number;
          count += 1;
        }
      const o = (y * width + x) * 4;
      data[o] = r / count;
      data[o + 1] = g / count;
      data[o + 2] = b / count;
      data[o + 3] = 255;
    }
  }
  return { image: { width, height, data }, factor };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Color del fondo: mediana por canal del marco exterior de la foto. */
function backgroundColor(image: RawImage): [number, number, number] {
  const ring = Math.max(2, Math.round(Math.min(image.width, image.height) * 0.05));
  const channels: number[][] = [[], [], []];
  for (let y = 0; y < image.height; y += 1)
    for (let x = 0; x < image.width; x += 1) {
      if (x >= ring && x < image.width - ring && y >= ring && y < image.height - ring) {
        x = image.width - ring - 1;
        continue;
      }
      const i = (y * image.width + x) * 4;
      for (let c = 0; c < 3; c += 1) (channels[c] as number[]).push(image.data[i + c] as number);
    }
  return [
    median(channels[0] as number[]),
    median(channels[1] as number[]),
    median(channels[2] as number[]),
  ];
}

/** Umbral de Otsu sobre un histograma de 256 casillas. */
function otsu(histogram: Uint32Array, total: number): number {
  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) sumAll += i * (histogram[i] as number);
  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t += 1) {
    weightBack += histogram[t] as number;
    if (weightBack === 0) continue;
    const weightFront = total - weightBack;
    if (weightFront === 0) break;
    sumBack += t * (histogram[t] as number);
    const meanBack = sumBack / weightBack;
    const meanFront = (sumAll - sumBack) / weightFront;
    const between = weightBack * weightFront * (meanBack - meanFront) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Máscara de primer plano: distancia de color al fondo (con suavizado 3×3) y umbral de Otsu. */
export function foregroundMask(image: RawImage): Uint8Array | null {
  const { width, height, data } = image;
  const [br, bg, bb] = backgroundColor(image);
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i += 1) {
    const o = i * 4;
    distance[i] = Math.hypot(
      (data[o] as number) - br,
      (data[o + 1] as number) - bg,
      (data[o + 2] as number) - bb,
    );
  }
  const smooth = new Float32Array(distance.length);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += distance[yy * width + xx] as number;
          count += 1;
        }
      smooth[y * width + x] = sum / count;
    }
  const histogram = new Uint32Array(256);
  for (const d of smooth) {
    const bin = Math.min(255, Math.round((d / 441.7) * 255));
    histogram[bin] = (histogram[bin] as number) + 1;
  }
  const levelOtsu = otsu(histogram, smooth.length);
  // Piso absoluto: sin contraste suficiente entre pieza y fondo no hay contorno confiable.
  const threshold = Math.max((levelOtsu / 255) * 441.7, 30);
  const mask = new Uint8Array(smooth.length);
  let foreground = 0;
  for (let i = 0; i < smooth.length; i += 1)
    if ((smooth[i] as number) > threshold) {
      mask[i] = 1;
      foreground += 1;
    }
  return foreground > 0 ? mask : null;
}

/** Componente conexa (4 vecinos) más grande; devuelve sus píxeles de borde y su área. */
function largestComponent(mask: Uint8Array, width: number, height: number) {
  const label = new Int32Array(mask.length);
  const stack: number[] = [];
  let bestLabel = 0;
  let bestArea = 0;
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
    if (area > bestArea) {
      bestArea = area;
      bestLabel = next;
    }
  }
  if (bestLabel === 0) return null;
  const boundary: Point[] = [];
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (label[index] !== bestLabel) continue;
      const edge =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        label[index - 1] !== bestLabel ||
        label[index + 1] !== bestLabel ||
        label[index - width] !== bestLabel ||
        label[index + width] !== bestLabel;
      if (edge) boundary.push({ x: x + 0.5, y: y + 0.5 });
    }
  return { boundary, area: bestArea };
}

/** Envolvente convexa (cadena monótona de Andrew). */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2] as Point, out[out.length - 1] as Point, p) <= 0
      )
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/** Reduce un polígono convexo a 4 vértices quitando siempre el que menos área aporta. */
export function simplifyToQuad(hull: readonly Point[]): Point[] | null {
  if (hull.length < 4) return null;
  const poly = [...hull];
  while (poly.length > 4) {
    let bestIndex = 0;
    let bestLoss = Infinity;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[(i + poly.length - 1) % poly.length] as Point;
      const b = poly[i] as Point;
      const c = poly[(i + 1) % poly.length] as Point;
      const loss = polygonArea([a, b, c]);
      if (loss < bestLoss) {
        bestLoss = loss;
        bestIndex = i;
      }
    }
    poly.splice(bestIndex, 1);
  }
  return poly;
}

/** Recta robusta (sin atípicos) por los puntos de borde cercanos al lado `a`→`b`. */
function fitSide(boundary: readonly Point[], a: Point, b: Point, tolerance: number): Line | null {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return null;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const picked: Point[] = [];
  for (const p of boundary) {
    const along = (p.x - a.x) * ux + (p.y - a.y) * uy;
    const across = Math.abs(-(p.x - a.x) * uy + (p.y - a.y) * ux);
    if (along > length * 0.1 && along < length * 0.9 && across <= tolerance) picked.push(p);
  }
  if (picked.length < 5) return null;
  return fitLineRobust(picked)?.line ?? null;
}

/** Afina las esquinas al subpíxel: ajusta una recta a cada lado e intersecta las contiguas. */
export function refineCorners(rough: Quad, boundary: readonly Point[], tolerance = 3): Quad {
  const lines = [0, 1, 2, 3].map((i) => fitSide(boundary, rough[i] as Point, rough[(i + 1) % 4] as Point, tolerance));
  const refined = rough.map((corner, i) => {
    const previous = lines[(i + 3) % 4];
    const current = lines[i];
    if (!previous || !current) return corner;
    const point = intersectLines(previous, current);
    // Si la intersección se aleja demasiado de la esquina aproximada, no se confía en el ajuste.
    return point && Math.hypot(point.x - corner.x, point.y - corner.y) < 12 ? point : corner;
  });
  return refined as Quad;
}

/**
 * Detecta el contorno de UNA pieza sobre un fondo relativamente uniforme. Trabaja sobre la imagen que recibe
 * (se espera ya reducida a `DETECT_MAX_SIDE`); las coordenadas devueltas son de esa imagen.
 */
export function detectQuad(image: RawImage): Detection | null {
  const mask = foregroundMask(image);
  if (!mask) return null;
  const component = largestComponent(mask, image.width, image.height);
  if (!component) return null;
  const hull = convexHull(component.boundary);
  const simplified = simplifyToQuad(hull);
  if (!simplified) return null;
  const corners = refineCorners(orderCorners(simplified), component.boundary);
  if (!isConvexQuad(corners)) return null;

  const imageArea = image.width * image.height;
  const quadArea = polygonArea(corners);
  const coverage = quadArea / imageArea;
  if (coverage < 0.1 || coverage > 0.98) return null;

  // Confianza: cuánto del cuadrilátero está realmente ocupado por la pieza y qué tan fiel es el cuadrilátero al casco.
  const fill = Math.min(1, component.area / quadArea);
  const hullFit = Math.min(
    1,
    polygonArea(hull) === 0
      ? 0
      : Math.min(quadArea, polygonArea(hull)) / Math.max(quadArea, polygonArea(hull)),
  );
  const confidence = Math.max(0, Math.min(1, fill * hullFit));
  return { corners: corners as Quad, confidence };
}
