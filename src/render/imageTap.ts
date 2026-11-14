// Taps and clicks on the fluoro image (docs/SPEC.md F5.2; owner decision
// 2026-11-13): which pixel of the image AS TAKEN a canvas pixel shows, so
// createProjection(store.lastImagePose).unproject(pixel) is the ray that made
// it. Plain TypeScript, no browser code.
import { IMAGE_SIZE_PX, type Pixel } from '../core/geometry';
import { unorientPixel, type Orientation } from './orientation';
import { detectorPosition, isCollimated, type Collimation } from './pipeline';

export interface TapSettings {
  /** The display flips and rotation the held image is shown with now (step 6). */
  orientation: Orientation;
  /** The magnification the held image was taken with (step 1). */
  magnification: number;
  /** The shutters the held image was taken with (step 4). */
  collimation: Collimation;
}

/**
 * The image pixel for canvas pixel `canvasPixel` (on the 512×512 canvas grid,
 * (0, 0) top-left; a position inside a pixel counts as that pixel): the
 * flips/rotation undone (unorientPixel), then — unless a shutter covers it —
 * the magnification undone (the detector position, pipeline step 1). Null for
 * a covered pixel or a position off the image.
 */
export function imageTapPixel(canvasPixel: Pixel, settings: TapSettings): Pixel | null {
  const x = Math.floor(canvasPixel.x);
  const y = Math.floor(canvasPixel.y);
  if (x < 0 || y < 0 || x >= IMAGE_SIZE_PX || y >= IMAGE_SIZE_PX) return null;
  const taken = unorientPixel({ x, y }, settings.orientation);
  if (isCollimated(taken.x, taken.y, settings.collimation)) return null;
  return detectorPosition(taken, settings.magnification);
}
