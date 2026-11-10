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
