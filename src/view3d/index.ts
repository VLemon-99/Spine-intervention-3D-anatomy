// 3D see-through view — F8.
// mount() builds this zone's panel (view3d-panel): a compact toggle row with
// the '3D view' button, and below it the 3D canvas, hidden until the learner
// turns the view on (owner decision 2026-11-11: off at start).
//
// The 3D view only reads the store, never changes it. It draws on demand
// (when something changed), not in a constant loop. The WebGL renderer is
// made the first time the view is turned on.

import { WebGLRenderer } from 'three';
import { registerDebugGetter } from '../core/debugRegistry';
import { store } from '../core/store';
import type { Volume } from '../core/types';
import { createView3dScene, triangleCount } from './scene';

// Every button is at least 44×44 px (F12 owns the final layout).
const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  minWidth: '64px',
  minHeight: '44px',
  padding: '0 10px',
  fontSize: '14px',
  cursor: 'pointer',
  borderRadius: '6px',
  border: '1px solid #5a6676',
  color: '#10151c',
  touchAction: 'manipulation',
};

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'view3d-panel';
  panel.setAttribute('aria-label', '3D view');
  panel.className = 'panel';
  Object.assign(panel.style, { display: 'flex', flexDirection: 'column', gap: '6px' });

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-view3d';
  marker.hidden = true;

  // The toggle row: the title and the buttons share one line to save space.
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: '0 0 auto' });

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = '3D view';
  heading.style.margin = '0 6px 0 0';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.testid = 'view3d-toggle';
  toggle.textContent = '3D view';
  toggle.title = 'Show or hide the 3D see-through view';
  Object.assign(toggle.style, BUTTON_STYLE);
  row.append(heading, toggle);

  const area = document.createElement('div');
  Object.assign(area.style, { flex: '1 1 auto', minHeight: '0', position: 'relative', display: 'none' });
  const canvas = document.createElement('canvas');
  canvas.dataset.testid = 'view3d-canvas';
  canvas.setAttribute('aria-label', '3D scene of the anatomy');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  area.append(canvas);

  panel.append(marker, row, area);
  element.append(panel);

  const view = createView3dScene();
  let shown = false;
  let renderer: WebGLRenderer | null = null;
  let builtVolume: Volume | null | undefined;
  let frameRequested = false;

  const draw = (): void => {
    frameRequested = false;
    if (!shown || !renderer) return;
    renderer.render(view.scene, view.camera);
  };
  /** Draw on demand: at most one frame per animation frame, and only while shown. */
  const requestDraw = (): void => {
    if (!shown || frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(draw);
  };

  const resize = (): void => {
    if (!renderer) return;
    const width = Math.max(1, Math.floor(area.clientWidth));
    const height = Math.max(1, Math.floor(area.clientHeight));
    renderer.setSize(width, height, false);
    view.setAspect(width / height);
    requestDraw();
  };

  const syncVolume = (volume: Volume | null): void => {
    if (volume === builtVolume) return;
    builtVolume = volume;
    view.setVolume(volume);
    requestDraw();
  };

  const setShown = (on: boolean): void => {
    shown = on;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.style.background = on ? '#cfe3ff' : '#f2f4f7';
    toggle.style.fontWeight = on ? '700' : '400';
    area.style.display = on ? 'block' : 'none';
    if (on && !renderer) {
      renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      new ResizeObserver(resize).observe(area);
    }
    if (on) resize();
  };

  setShown(false);
  syncVolume(store.get().volume);
  store.subscribe((state) => syncVolume(state.volume));
  toggle.addEventListener('click', () => setShown(!shown));

  registerDebugGetter('view3d', () => {
    const { position } = view.camera;
    const target = view.target;
    return {
      shown,
      toggleEnabled: !toggle.disabled,
      objects: [view.bone].map((object) => ({
        name: object.name,
        visible: object.visible,
        triangles: triangleCount(object.geometry),
      })),
      camera: {
        position: { x: position.x, y: position.y, z: position.z },
        target: { x: target.x, y: target.y, z: target.z },
      },
    };
  });
}
