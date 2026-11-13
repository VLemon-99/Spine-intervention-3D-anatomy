// The fluoro image canvas (docs/SPEC.md F0.6): a 512×512 WebGL2 canvas drawn
// with Three.js. It stays blank (black, like a monitor with no image) until
// the first exposure. On every 'exposure' event it draws the X-ray image (DRR)
// of the store's volume at the pose the image was taken with.
//
// preserveDrawingBuffer keeps the last frame readable, so screen tests can
// read the pixels (tests/fixtures/readCanvas.ts) and the image stays on
// screen until the next exposure (last image hold).
//
// For each exposure it remembers how the image was taken (pose, a copy of the
// render settings, and the noise seed = an image counter: 1 for the first
// image after page load, then 2, 3 …). Screen tests read this through the
// 'render' debug getter.
//
// The image is drawn in two steps (see drrGpu.ts): each exposure takes the
// X-ray image into a held off-screen image and then displays it. When a
// display setting (invert, flips, rotation) changes, only the display step runs again — the
// held image is re-shown at once, with no new exposure. The store's needle
// (its shaft) is drawn into each new image.
//
// A click (desktop) or tap (tablet) on the held image emits 'imageTap' with
// the pixel of the image as taken (imageTap.ts); nothing before the first
// image or on a pixel covered by a shutter.
import { Color, WebGLRenderer } from 'three';
import { IMAGE_SIZE_PX } from '../core/geometry';
import { registerDebugGetter } from '../core/debugRegistry';
import type { EventBus, Store } from '../core/store';
import type { CArmPose, ImageKind } from '../core/types';
import { createDrrGpu } from './drrGpu';
import { imageTapPixel } from './imageTap';
import { noiseLevelFor } from './pipeline';
import { cloneSettings, renderSettings, type RenderSettings, type SettingsStore } from './settings';

/** How the image on screen was taken. */
export interface LastImage {
  pose: CArmPose;
  settings: RenderSettings;
  /** Seed of the image's grain: the image counter since page load (1, 2, 3 …). */
  noiseSeed: number;
  /** 'shot' or 'fluoro' (the store's lastImageKind at the exposure), or null if it was not set. */
  kind: ImageKind | null;
  /** The noise level the image was actually taken with: higher than the setting for a fluoro frame. */
  noiseLevel: number;
}

const BLANK = new Color(0x000000);
/** Shown when an image is taken with no volume loaded (nothing in the beam). */
const NO_VOLUME = new Color(0xe6e6e6);

/** Create the canvas inside `parent`. Returns null if WebGL2 is not available (F12.5 shows a message). */
export function createFluoroCanvas(
  parent: HTMLElement,
  store: Store,
  bus: EventBus,
  settings: SettingsStore = renderSettings,
): HTMLCanvasElement | null {
  let lastImage: LastImage | null = null;
  let imageCount = 0;
  registerDebugGetter('render', () => ({
    settings: cloneSettings(settings.get()),
    lastImage: lastImage && { ...lastImage, pose: { ...lastImage.pose }, settings: cloneSettings(lastImage.settings) },
  }));
  bus.on('exposure', () => {
    const { lastImagePose, lastImageKind, pose } = store.get();
    imageCount += 1;
    const taken = cloneSettings(settings.get());
    lastImage = {
      pose: { ...(lastImagePose ?? pose) },
      settings: taken,
      noiseSeed: imageCount,
      kind: lastImageKind,
      noiseLevel: noiseLevelFor(lastImageKind, taken.noiseLevel),
    };
  });

  const canvas = document.createElement('canvas');
  canvas.dataset.testid = 'fluoro-canvas';
  canvas.width = IMAGE_SIZE_PX;
  canvas.height = IMAGE_SIZE_PX;
  Object.assign(canvas.style, {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: '1 / 1',
    margin: '0 auto',
    background: '#000',
  });
  parent.append(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: false });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(IMAGE_SIZE_PX, IMAGE_SIZE_PX, false);
  const drr = createDrrGpu(renderer);

  const fill = (color: Color): void => {
    renderer.setClearColor(color, 1);
    renderer.clear();
  };

  /** True while the canvas shows a held X-ray image (not the blank or no-volume fill). */
  let holding = false;
  const display = (): void => {
    const { invert, flipHorizontal, flipVertical, rotation } = settings.get();
    drr.display({ invert, flipHorizontal, flipVertical, rotation });
  };

  fill(BLANK);
  bus.on('exposure', () => {
    const { volume } = store.get();
    if (volume && lastImage) {
      // Taken with the settings as they were at the exposure.
      const { magnification, collimation } = lastImage.settings;
      // Contrast belongs to taking the image: whatever is in the store now is in this image.
      drr.take(volume, lastImage.pose, {
        magnification,
        collimation,
        contrast: store.get().contrast,
        // Fresh grain for every image; a reloaded page repeats the same sequence of seeds.
        noise: { seed: lastImage.noiseSeed, level: lastImage.noiseLevel },
        // The needle as it is at this exposure (F7.1).
        needle: store.get().needle?.shaft ?? null,
      });
      holding = true;
      display();
    } else {
      holding = false;
      fill(NO_VOLUME);
    }
  });
  // A click, or a tap (which the browser also reports as a click), on the held image.
  canvas.addEventListener('click', (event) => {
    if (!holding || !lastImage) return;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const { flipHorizontal, flipVertical, rotation } = settings.get();
    const pixel = imageTapPixel(
      {
        x: ((event.clientX - box.left) / box.width) * IMAGE_SIZE_PX,
        y: ((event.clientY - box.top) / box.height) * IMAGE_SIZE_PX,
      },
      {
        orientation: { flipHorizontal, flipVertical, rotation },
        magnification: lastImage.settings.magnification,
        collimation: lastImage.settings.collimation,
      },
    );
    if (pixel) bus.emit('imageTap', pixel);
  });
  // Display settings apply straight away, to the held image.
  settings.subscribe(() => {
    if (holding) display();
  });
  return canvas;
}
