// Shared image service (owner decision 2026-11-14): lets a zone ask for an
// X-ray image without importing the render zone. The render zone registers
// its renderer here at mount; the quiz (F11) asks for the image of a volume
// at a pose and draws it on its own canvas. Plain TypeScript, no browser code.

import type { CArmPose, Volume } from './types';

/** A grey image: one value 0–255 per pixel, row by row from the top (pixel convention of geometry.ts). */
export interface DrrImage {
  width: number;
  height: number;
  /** width × height grey values; pixel (x, y) is at index x + width × y. */
  pixels: Uint8ClampedArray;
}

export interface ImageOptions {
  /** Seed of the image's grain; the same seed gives the same image. */
  noiseSeed?: number;
}

/**
 * Draws the X-ray image of `volume` at `pose` off screen, as a plain single
 * shot (magnification 1, no collimation, not inverted, no flip or rotation,
 * no needle, no contrast). It must not change the image held on the fluoro
 * panel, the counters or the store. Returns null when it cannot draw.
 */
export type ImageRenderer = (volume: Volume, pose: CArmPose, options?: ImageOptions) => DrrImage | null;

export interface ImageService {
  /** Set the renderer (the render zone does this at mount). A later call replaces it. */
  register(renderer: ImageRenderer): void;
  /** True once a renderer is registered. */
  available(): boolean;
  /** The image from the registered renderer, or null when there is none. */
  render(volume: Volume, pose: CArmPose, options?: ImageOptions): DrrImage | null;
}

export function createImageService(): ImageService {
  let current: ImageRenderer | null = null;
  return {
    register(renderer) {
      current = renderer;
    },
    available: () => current !== null,
    render: (volume, pose, options) => (current ? current(volume, pose, options) : null),
  };
}

/** The app's one image service. Unit tests make their own with createImageService(). */
export const imageService = createImageService();
