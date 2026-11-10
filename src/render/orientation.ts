// Image orientation (docs/SPEC.md F2.7) — step 6 of the ORDER OF STEPS in
// pipeline.ts: flip left-right, then flip up-down, then rotate clockwise.
// Plain TypeScript, no browser code; both renderers' tests use it.
//
// With pixel (x, y) counted from the top-left of the 512×512 image:
//   flip left-right   (x, y) → (511 − x, y)
//   flip up-down      (x, y) → (x, 511 − y)
//   rotate 90° clockwise  (x, y) → (511 − y, x)
import { IMAGE_SIZE_PX, type Pixel } from '../core/geometry';

export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export interface Orientation {
  flipHorizontal: boolean;
  flipVertical: boolean;
  /** Clockwise, in degrees, applied after the flips. */
  rotation: Rotation;
}

/** Number of 90° clockwise turns; anything but 0, 90, 180 or 270 is an error. */
function quarterTurns(rotation: number): number {
  const turns = ROTATIONS.indexOf(rotation as Rotation);
  if (turns < 0) throw new Error(`Unsupported rotation ${String(rotation)}: it must be 0, 90, 180 or 270.`);
  return turns;
}

/**
 * Where pixel `pixel` of the image as taken is shown after the flips and the
 * rotation. `last` is the largest pixel number (511); pass 512 instead to move
 * exact positions inside pixels (e.g. a pixel centre x + 0.5).
 */
export function orientPixel(pixel: Pixel, orientation: Orientation, last: number = IMAGE_SIZE_PX - 1): Pixel {
  const turns = quarterTurns(orientation.rotation);
  let { x, y } = pixel;
  if (orientation.flipHorizontal) x = last - x;
  if (orientation.flipVertical) y = last - y;
  for (let n = 0; n < turns; n++) [x, y] = [last - y, x];
  return { x, y };
}

/** The opposite of orientPixel: which pixel of the image as taken is shown at `pixel`. */
export function unorientPixel(pixel: Pixel, orientation: Orientation, last: number = IMAGE_SIZE_PX - 1): Pixel {
  const turns = quarterTurns(orientation.rotation);
  let { x, y } = pixel;
  for (let n = 0; n < turns; n++) [x, y] = [y, last - x];
  if (orientation.flipVertical) y = last - y;
  if (orientation.flipHorizontal) x = last - x;
  return { x, y };
}
