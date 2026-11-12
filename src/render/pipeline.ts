// The numbers and the ORDER OF STEPS that the two X-ray renderers share
// (docs/SPEC.md F2): the GPU shader (drrGpu.ts) and the CPU reference
// (drrCpu.ts). Both must follow this order exactly, or their images differ.
//
// ORDER OF STEPS
//
// A. Taking the image (the result is frozen until the next exposure)
//   1. Magnification m (1, 1.5 or 2): image pixel p looks at the detector
//      position  centre + (p − centre) / m,  with centre = (256, 256).
//   2. Absorption: a ray runs from the X-ray source through that detector
//      position. Along the part inside the volume's box, samples are taken at
//      entry + (i + 0.5) × MARCH_STEP_MM (nearest voxel), and
//        total = sum of (intensity / 255 × ABSORPTION_PER_MM
//                        + extra / 255 × EXTRA_ABSORPTION_PER_MM) × step
//        value = e^(−total)          (1 = full brightness, 0 = black)
//      `extra` is the optional extra absorption volume (contrast, F2.8).
//   3. Noise: seeded grain is added, and the result is kept within 0…1.
//   4. Collimation: pixels outside the open area get the fixed "no signal"
//      value, and no noise.
//
// B. Displaying the held image (applied straight away, no new exposure)
//   5. Invert: value → 1 − value.
//   6. Orientation: flip left-right, then flip up-down, then rotate clockwise
//      by 0°, 90°, 180° or 270°.
//
// Each later F2 story switches on one of these steps; this file gains the
// numbers they need (EXTRA_ABSORPTION_PER_MM, NO_SIGNAL, noise levels).

import { IMAGE_SIZE_PX, type Pixel } from '../core/geometry';

/** Distance between samples along each ray, mm (half a phantom voxel). */
export const MARCH_STEP_MM = 0.5;

/**
 * Absorption per mm of a voxel with full intensity (255). Chosen so that about
 * 8 cm of soft tissue lets roughly half the X-rays through and bone shows
 * clearly darker. A display setting, not a physical constant.
 */
export const ABSORPTION_PER_MM = 0.025;

/** Most samples taken along one ray (the GPU shader's fixed loop limit). */
export const MAX_MARCH_STEPS = 4096;

/** The magnification settings on offer. */
export const MAGNIFICATIONS = [1, 1.5, 2] as const;
export type Magnification = (typeof MAGNIFICATIONS)[number];

/**
 * Step 1: the detector position that image pixel position `pixel` looks at,
 * at magnification m. Structures appear m times larger around the image centre.
 */
export function detectorPosition(pixel: Pixel, magnification: number): Pixel {
  const centre = IMAGE_SIZE_PX / 2;
  return {
    x: centre + (pixel.x - centre) / magnification,
    y: centre + (pixel.y - centre) / magnification,
  };
}

/** Step 4: the fixed "no signal" value of pixels covered by a shutter (black). */
export const NO_SIGNAL = 0;

/** Each shutter: the percentage of the image it covers from that edge, 0–50. */
export interface Collimation {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Step 4: is image pixel (x, y) — whole numbers, (0, 0) at the top-left —
 * covered by a shutter? Measured on the image as taken (after magnification,
 * before any flip or rotation). left = 20 covers the columns x < 0.2 × 512;
 * the other three edges work the same way, counted from their own edge.
 */
export function isCollimated(x: number, y: number, collimation: Collimation): boolean {
  const last = IMAGE_SIZE_PX - 1;
  const covered = (fromEdge: number, percent: number): boolean => fromEdge < (percent / 100) * IMAGE_SIZE_PX;
  return (
    covered(x, collimation.left) ||
    covered(last - x, collimation.right) ||
    covered(y, collimation.top) ||
    covered(last - y, collimation.bottom)
  );
}

/**
 * Step 3: the most the grain can change a pixel's value (0…1 scale) at noise
 * level 1. At level L a pixel changes by at most ± NOISE_AMPLITUDE × L.
 */
export const NOISE_AMPLITUDE = 0.25;

/**
 * Default noise levels: a continuous-fluoro frame is grainier than a single
 * shot. A look-and-feel choice the owner may tune; the shot level is kept
 * small (about ± 2.5 grey levels of 255).
 */
export const DEFAULT_NOISE_LEVEL = { shot: 0.04, fluoro: 0.1 } as const;

export function defaultNoiseLevel(kind: 'shot' | 'fluoro'): number {
  return DEFAULT_NOISE_LEVEL[kind];
}

/**
 * Step 2: absorption per mm of a voxel of the extra absorption volume at full
 * strength (255) — used for contrast (F2.8, F9). Chosen so a few millimetres
 * of full-strength contrast is clearly darker than soft tissue (3 mm lets
 * about 40% through). A display number that F9 or the owner may tune.
 */
export const EXTRA_ABSORPTION_PER_MM = 0.3;

/**
 * The noise level an image is actually taken with (F2.6). A single shot (or an
 * image of unknown kind) uses the setting as it is. A continuous-fluoro frame
 * is grainier: the setting × (default fluoro level ÷ default shot level), kept
 * within 0…1.
 */
export function noiseLevelFor(kind: 'shot' | 'fluoro' | null, setting: number): number {
  if (kind !== 'fluoro') return setting;
  const ratio = DEFAULT_NOISE_LEVEL.fluoro / DEFAULT_NOISE_LEVEL.shot;
  return Math.min(1, Math.max(0, setting * ratio));
}
