import { DETECT_MAX_SIDE, MIN_CONFIDENCE, detectQuad } from '../../utils/scanner/detect';
import {
  centeredCropQuad,
  clampQuad,
  denormalizeQuad,
  normalizeQuad,
  orientQuad,
  quadSize,
  targetSize,
} from '../../utils/scanner/geometry';
import type { Aspect, Quad, RawImage } from '../../utils/scanner/types';
import { warpPerspective } from '../../utils/scanner/warp';
import { ITEM_IMAGE_MAX_SIDE } from '../../utils/image';
import { encodeWithFallback } from '../../utils/scanner/encode';

// Operaciones de imagen del modo escáner. Corren igual dentro de un Web Worker (OffscreenCanvas) o, como
// degradación, en el hilo principal (canvas del DOM). Nada de esto se importa fuera de la ruta del escáner.

/** Lado mayor con el que se muestrea la foto para el recorte: sobra para una salida de 1600 px. */
const SAMPLE_MAX_SIDE = 2400;

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export type ProcessOptions = {
  aspect: Aspect;
  /** Esquinas (normalizadas 0 a 1) elegidas a mano; si faltan, se detectan. */
  corners?: Quad;
  maxSide?: number;
};

export type ProcessOutput = {
  blob: Blob;
  /** Esquinas usadas, normalizadas respecto de la foto original (para reabrir el ajuste manual). */
  corners: Quad;
  /** Falso si no hubo detección confiable y se usó el recorte centrado. */
  detected: boolean;
  confidence: number;
  /** Falso si el navegador no codifica WebP y la salida es JPEG. */
  webpSupported: boolean;
  /** Proporción ancho/alto de la foto original (para dibujar el ajuste manual sin deformar). */
  sourceAspect: number;
  /** Lado mayor (px de la foto original) de la región recortada: lo que la fuente realmente dio. */
  cropLongSide: number;
  /** Verdadero si la región recortada tiene menos de `MIN_CROP_LONG_SIDE` px: se avisa, sin bloquear. */
  lowResolution: boolean;
};

/** La salida recortada debe tener al menos este lado mayor cuando la fuente lo permita. */
export const MIN_CROP_LONG_SIDE = 1000;

export type FrameDetection = {
  /** Esquinas normalizadas (0 a 1) respecto del cuadro analizado. */
  corners: Quad;
  confidence: number;
};

/** Error del pipeline: `code` estable para mapear a un mensaje; `detail` es la causa técnica (para soporte). */
export class ScannerImageError extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: AnyCanvas): AnyContext {
  const context = canvas.getContext('2d') as AnyContext | null;
  if (!context) throw new ScannerImageError('decode_failed');
  return context;
}

function scaledSize(width: number, height: number, maxSide: number) {
  const factor = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

function rasterize(bitmap: ImageBitmap, maxSide: number): RawImage {
  const { width, height } = scaledSize(bitmap.width, bitmap.height, maxSide);
  const canvas = createCanvas(width, height);
  const context = context2d(canvas);
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { width, height, data };
}

/** WebP si el navegador lo codifica; si no, JPEG (ver `encodeWithFallback`). */
async function encodeImage(canvas: AnyCanvas): Promise<{ blob: Blob; webpSupported: boolean }> {
  const result = await encodeWithFallback(async (type, quality) =>
    'convertToBlob' in canvas
      ? canvas.convertToBlob({ type, quality })
      : new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality)),
  );
  if (result.ok) return { blob: result.blob, webpSupported: result.webpSupported };
  throw new ScannerImageError(
    'encode_failed',
    result.reason === 'too_large'
      ? 'La imagen recortada no cabe en 5 MB ni con la calidad mínima'
      : `El navegador no entregó WebP ni JPEG (WebP ${result.webpSupported ? 'sí' : 'no'} soportado)`,
  );
}

/** Detecta (o usa las esquinas dadas), corrige la perspectiva, recorta y convierte a WebP. */
export async function processBitmap(
  bitmap: ImageBitmap,
  options: ProcessOptions,
): Promise<ProcessOutput> {
  const maxSide = options.maxSide ?? ITEM_IMAGE_MAX_SIDE;
  let normalized = options.corners;
  let confidence = 1;
  let detected = Boolean(options.corners);

  if (!normalized) {
    let small: RawImage | null = null;
    let found: ReturnType<typeof detectQuad> = null;
    try {
      small = rasterize(bitmap, DETECT_MAX_SIDE);
      found = detectQuad(small);
    } catch {
      // Sin detección no hay falla: se cae al recorte centrado y se abre el ajuste manual.
    }
    if (small && found && found.confidence >= MIN_CONFIDENCE) {
      normalized = normalizeQuad(found.corners, small.width, small.height);
      confidence = found.confidence;
      detected = true;
    } else {
      confidence = found?.confidence ?? 0;
      normalized = normalizeQuad(
        centeredCropQuad(bitmap.width, bitmap.height, options.aspect),
        bitmap.width,
        bitmap.height,
      );
    }
  }

  const sample = rasterize(bitmap, SAMPLE_MAX_SIDE);
  const quad = orientQuad(
    clampQuad(
      denormalizeQuad(normalized, sample.width, sample.height),
      sample.width,
      sample.height,
    ),
    options.aspect,
  );
  // La salida no se agranda más allá de lo que la fuente dio: una foto pobre se marca, no se infla.
  const scaleToOriginal = bitmap.width / sample.width;
  const cropSize = quadSize(quad);
  const cropLongSide = Math.max(cropSize.width, cropSize.height) * scaleToOriginal;
  const { width, height } = targetSize(
    options.aspect,
    Math.max(1, Math.min(maxSide, Math.round(cropLongSide))),
  );
  // Esquinas degeneradas (p. ej. ajuste manual con puntos encimados): se usa el recorte centrado en lugar de fallar.
  const warped =
    warpPerspective(sample, quad, width, height) ??
    warpPerspective(sample, centeredCropQuad(sample.width, sample.height, options.aspect), width, height);
  if (!warped) throw new ScannerImageError('warp_failed', 'No se pudo calcular la perspectiva');

  const canvas = createCanvas(width, height);
  context2d(canvas).putImageData(
    new ImageData(warped.data as Uint8ClampedArray<ArrayBuffer>, width, height),
    0,
    0,
  );
  const { blob, webpSupported } = await encodeImage(canvas);
  return {
    blob,
    corners: normalized,
    detected,
    confidence,
    webpSupported,
    sourceAspect: bitmap.width / bitmap.height,
    cropLongSide: Math.round(cropLongSide),
    lowResolution: cropLongSide < MIN_CROP_LONG_SIDE,
  };
}

/** Solo detección (sin recorte ni WebP): lo usa la guía de encuadre en vivo sobre cuadros del video. */
export function detectBitmap(bitmap: ImageBitmap): FrameDetection | null {
  const small = rasterize(bitmap, DETECT_MAX_SIDE);
  const found = detectQuad(small);
  if (!found) return null;
  return {
    corners: normalizeQuad(found.corners, small.width, small.height),
    confidence: found.confidence,
  };
}
