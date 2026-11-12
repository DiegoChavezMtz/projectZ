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
import { ITEM_IMAGE_MAX_BYTES, ITEM_IMAGE_MAX_SIDE, WEBP_QUALITIES } from '../../utils/image';

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

export class ScannerImageError extends Error {
  constructor(readonly code: string) {
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

async function encodeWebp(canvas: AnyCanvas): Promise<Blob> {
  for (const quality of WEBP_QUALITIES) {
    const blob =
      'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/webp', quality })
        : await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/webp', quality),
          );
    if (blob && blob.type === 'image/webp' && blob.size <= ITEM_IMAGE_MAX_BYTES) return blob;
  }
  throw new ScannerImageError('encode_failed');
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
    const small = rasterize(bitmap, DETECT_MAX_SIDE);
    const found = detectQuad(small);
    if (found && found.confidence >= MIN_CONFIDENCE) {
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
  const warped = warpPerspective(sample, quad, width, height);
  if (!warped) throw new ScannerImageError('warp_failed');

  const canvas = createCanvas(width, height);
  context2d(canvas).putImageData(
    new ImageData(warped.data as Uint8ClampedArray<ArrayBuffer>, width, height),
    0,
    0,
  );
  const blob = await encodeWebp(canvas);
  return {
    blob,
    corners: normalized,
    detected,
    confidence,
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
