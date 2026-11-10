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
// 'render' debug getter. The settings have no effect on the image yet.
import { Color, WebGLRenderer } from 'three';
import { IMAGE_SIZE_PX } from '../core/geometry';
import { registerDebugGetter } from '../core/debugRegistry';
import type { EventBus, Store } from '../core/store';
import type { CArmPose } from '../core/types';
import { createDrrGpu } from './drrGpu';
import { cloneSettings, renderSettings, type RenderSettings, type SettingsStore } from './settings';

/** How the image on screen was taken. */
export interface LastImage {
  pose: CArmPose;
  settings: RenderSettings;
  /** Seed of the image's grain: the image counter since page load (1, 2, 3 …). */
  noiseSeed: number;
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
    const { lastImagePose, pose } = store.get();
    imageCount += 1;
    lastImage = { pose: { ...(lastImagePose ?? pose) }, settings: cloneSettings(settings.get()), noiseSeed: imageCount };
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

  fill(BLANK);
  bus.on('exposure', () => {
    const { volume } = store.get();
    if (volume && lastImage) {
      drr.render(volume, lastImage.pose);
    } else {
      fill(NO_VOLUME);
    }
  });
  return canvas;
}
