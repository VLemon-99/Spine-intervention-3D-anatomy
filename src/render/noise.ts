// X-ray grain (noise) for the CPU reference — docs/SPEC.md F2.6, step 3 of the
// ORDER OF STEPS in pipeline.ts. Plain TypeScript, no browser code.
//
// Each pixel gets a zero-mean random amount that is the same every time for
// the same seed and pixel. It is scaled by the level (0 = none, 1 = maximum),
// added to the pixel's value, and the result is kept within 0…1.
//
// The GPU image uses its own seeded formula inside the shader; the two grain
// patterns do not have to be identical, only to behave the same way.
import { IMAGE_SIZE_PX } from '../core/geometry';
import { createRandom } from '../core/random';
import { NOISE_AMPLITUDE } from './pipeline';

export interface NoiseOptions {
  /** Which grain pattern: the same seed gives the same image. */
  seed: number;
  /** Amount of grain, 0 (none) … 1 (maximum). */
  level: number;
}

const PIXELS = IMAGE_SIZE_PX * IMAGE_SIZE_PX;

/**
 * The random number of one pixel for one seed, evenly spread over −0.5…0.5
 * (mean zero). Each seed uses its own stretch of the seeded sequence from
 * src/core/random.ts, one number per pixel.
 */
export function grainAt(seed: number, x: number, y: number): number {
  return createRandom(Math.trunc(seed) * PIXELS + x + IMAGE_SIZE_PX * y)() - 0.5;
}

/** Step 3: `value` (0…1) of pixel (x, y) with grain added, kept within 0…1. */
export function addNoise(value: number, noise: NoiseOptions, x: number, y: number): number {
  if (noise.level === 0) return value;
  const noisy = value + grainAt(noise.seed, x, y) * 2 * NOISE_AMPLITUDE * noise.level;
  return Math.min(1, Math.max(0, noisy));
}
