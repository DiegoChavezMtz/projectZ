// Spike S11-01: mide acierto, error de esquinas y tiempo de la detección propia sobre escenas sintéticas.
// Uso: pnpm exec tsx scripts/scanner-spike.ts
import { performance } from 'node:perf_hooks';
import { detectQuad, downscaleRaw, MIN_CONFIDENCE } from '../src/features/claimEvents/utils/scanner/detect';
import { orientQuad, scaleQuad, targetSize } from '../src/features/claimEvents/utils/scanner/geometry';
import { warpPerspective } from '../src/features/claimEvents/utils/scanner/warp';
import { cardQuad, maxCornerError, renderScene, type Background } from '../tests/helpers/scannerScenes';

const backgrounds: Background[] = ['dark', 'light', 'wood', 'green'];
const poses = [
  { degrees: 0, tilt: 0, scale: 0.75 },
  { degrees: 6, tilt: 0.05, scale: 0.7 },
  { degrees: -12, tilt: 0.1, scale: 0.65 },
  { degrees: 25, tilt: 0.08, scale: 0.6 },
  { degrees: 40, tilt: 0, scale: 0.55 },
];
const W = 1200;
const H = 1600;
const aspect = { width: 63, height: 88 };

let total = 0;
let ok = 0;
const detectMs: number[] = [];
const warpMs: number[] = [];
const errors: number[] = [];

for (const background of backgrounds)
  for (const pose of poses)
    for (const seed of [1, 2]) {
      const scene = renderScene({ width: W, height: H, background, quad: cardQuad(W, H, pose), noise: 8, seed });
      const t0 = performance.now();
      const { image, factor } = downscaleRaw(scene.image, 320);
      const found = detectQuad(image);
      const t1 = performance.now();
      total += 1;
      detectMs.push(t1 - t0);
      if (!found || found.confidence < MIN_CONFIDENCE) continue;
      const corners = scaleQuad(found.corners, factor);
      const error = maxCornerError(corners, scene.truth);
      errors.push(error);
      if (error < 0.02 * Math.hypot(W, H)) ok += 1; // < 2 % de la diagonal
      const { width, height } = targetSize(aspect, 1600);
      const t2 = performance.now();
      warpPerspective(scene.image, orientQuad(corners, aspect), width, height);
      warpMs.push(performance.now() - t2);
    }

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
const max = (v: number[]) => Math.max(0, ...v);
console.log(`escenas: ${total}, aciertos (<2 % de la diagonal): ${ok} (${Math.round((ok / total) * 100)} %)`);
console.log(`error de esquina px (de ${W}x${H}): promedio ${avg(errors).toFixed(1)}, máx ${max(errors).toFixed(1)}`);
console.log(`detección (reducir + contorno): promedio ${avg(detectMs).toFixed(0)} ms, máx ${max(detectMs).toFixed(0)} ms`);
console.log(`warp a 1145x1600: promedio ${avg(warpMs).toFixed(0)} ms, máx ${max(warpMs).toFixed(0)} ms`);
