export type Point = { x: number; y: number };

/** Esquinas en orden: superior izquierda, superior derecha, inferior derecha, inferior izquierda. */
export type Quad = [Point, Point, Point, Point];

/** Imagen en RGBA, compatible con `ImageData` (sin depender del DOM). */
export type RawImage = { width: number; height: number; data: Uint8ClampedArray };

export type Aspect = { width: number; height: number };

export type Detection = {
  corners: Quad;
  /** 0 a 1: qué tan limpio es el contorno encontrado. Por debajo de `MIN_CONFIDENCE` se ofrece recorte manual. */
  confidence: number;
};
