// The fluoro image canvas (docs/SPEC.md F0.6): a 512×512 WebGL2 canvas drawn
// with Three.js. It stays blank (black, like a monitor with no image) until
// the first exposure and draws a new frame on every 'exposure' event.
// F0-S13 draws a flat fill; the X-ray image (DRR) replaces it in F0-S14/S15.
//
// preserveDrawingBuffer keeps the last frame readable, so screen tests can
// read the pixels (tests/fixtures/readCanvas.ts) and the image stays on
// screen until the next exposure (last image hold).
import { Color, WebGLRenderer } from 'three';
import { IMAGE_SIZE_PX } from '../core/geometry';
import type { EventBus } from '../core/store';

const BLANK = new Color(0x000000);
const FLAT_IMAGE = new Color(0x808080);

/** Create the canvas inside `parent`. Returns null if WebGL2 is not available (F12.5 shows a message). */
export function createFluoroCanvas(parent: HTMLElement, bus: EventBus): HTMLCanvasElement | null {
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

  const fill = (color: Color): void => {
    renderer.setClearColor(color, 1);
    renderer.clear();
  };

  fill(BLANK);
  bus.on('exposure', () => fill(FLAT_IMAGE));
  return canvas;
}
