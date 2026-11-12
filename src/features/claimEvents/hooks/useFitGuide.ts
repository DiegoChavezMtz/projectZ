'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FrameDetection } from '../services/scanner/scannerImage';
import { assessFit, guideRectInVideo, type FitState } from '../utils/scanner/fit';
import { denormalizeQuad } from '../utils/scanner/geometry';
import { MIN_CONFIDENCE } from '../utils/scanner/detect';

export const FIT_SAMPLE_MS = 400;
/** El mismo veredicto debe repetirse este número de muestras seguidas antes de mostrarse (evita parpadeo). */
const STABLE_SAMPLES = 2;

type Params = {
  videoRef: RefObject<HTMLVideoElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  guideRef: RefObject<HTMLElement | null>;
  /** Analiza un cuadro del video (worker). Sin esta función la guía queda en `none`. */
  detect?: (frame: ImageBitmap) => Promise<FrameDetection | null>;
  active: boolean;
};

/**
 * Orientación de encuadre en vivo: cada ~0.4 s analiza un cuadro reducido del video, compara la pieza con el
 * marco guía (≥ 80 % del marco, derecha, sin perspectiva fuerte) y devuelve `fits | closer | back | straighten`.
 */
export function useFitGuide({ videoRef, viewportRef, guideRef, detect, active }: Params): FitState {
  const [state, setState] = useState<FitState>('none');
  const last = useRef<{ state: FitState; count: number }>({ state: 'none', count: 0 });

  useEffect(() => {
    if (!active || !detect) return;
    let running = false;
    let cancelled = false;

    const sample = async () => {
      const video = videoRef.current;
      const viewport = viewportRef.current;
      const guide = guideRef.current;
      if (running || !video || !viewport || !guide || video.videoWidth === 0) return;
      running = true;
      try {
        const frame = await createImageBitmap(video, {
          resizeWidth: 320,
          resizeQuality: 'low',
        }).catch(() => createImageBitmap(video));
        const detection = await detect(frame);
        if (cancelled) return;
        const v = viewport.getBoundingClientRect();
        const g = guide.getBoundingClientRect();
        let next: FitState = 'none';
        if (detection && detection.confidence >= MIN_CONFIDENCE) {
          const rect = guideRectInVideo(
            { width: v.width, height: v.height },
            { x: g.left - v.left, y: g.top - v.top, width: g.width, height: g.height },
            { width: video.videoWidth, height: video.videoHeight },
          );
          const quad = denormalizeQuad(detection.corners, video.videoWidth, video.videoHeight);
          next = assessFit(quad, rect).state;
        }
        const previous = last.current;
        last.current = { state: next, count: previous.state === next ? previous.count + 1 : 1 };
        if (last.current.count >= STABLE_SAMPLES) setState(next);
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => void sample(), FIT_SAMPLE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, detect, videoRef, viewportRef, guideRef]);

  return active && detect ? state : 'none';
}
