// 3D see-through view — F8.
// mount() builds this zone's panel (view3d-panel): a compact toggle row with
// the '3D view' button, and below it the 3D canvas, hidden until the learner
// turns the view on (owner decision 2026-11-11: off at start).
//
// The 3D view only reads the store, never changes it. It draws on demand
// (when something changed), not in a constant loop. The WebGL renderer is
// made the first time the view is turned on.

import { Mesh, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { registerDebugGetter } from '../core/debugRegistry';
import { store } from '../core/store';
import type { CArmPose, Mode, NeedleState, Vec3, Volume } from '../core/types';
import { LAYERS } from './layers';
import { createView3dScene, triangleCount } from './scene';

// Every button is at least 44×44 px (F12 owns the final layout).
const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  minWidth: '44px',
  minHeight: '44px',
  padding: '0 8px',
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

  /** Show an on/off button's state. */
  const paint = (button: HTMLButtonElement, on: boolean): void => {
    button.setAttribute('aria-pressed', String(on));
    button.style.background = on ? '#cfe3ff' : '#f2f4f7';
    button.style.fontWeight = on ? '700' : '400';
  };

  const area = document.createElement('div');
  Object.assign(area.style, { flex: '1 1 auto', minHeight: '0', position: 'relative', display: 'none' });
  const canvas = document.createElement('canvas');
  canvas.dataset.testid = 'view3d-canvas';
  canvas.setAttribute('aria-label', '3D scene of the anatomy');
  // touch-action: none — finger drags and pinches on the canvas turn and zoom
  // the 3D view instead of scrolling or zooming the page (F8.3).
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    touchAction: 'none',
  });
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

  // Orbit and zoom (F8.3): drag to orbit around the target, wheel to zoom.
  // OrbitControls stops the wheel from scrolling the page and sets
  // touch-action: none on the canvas. It turns the camera around view.target.
  const controls = new OrbitControls(view.camera, canvas);
  controls.target = view.target;
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 20000;
  controls.addEventListener('change', requestDraw);

  const syncVolume = (volume: Volume | null): void => {
    if (volume === builtVolume) return;
    builtVolume = volume;
    view.setVolume(volume);
    controls.update();
    requestDraw();
  };

  let builtNeedle: NeedleState | null | undefined;
  const syncNeedle = (needle: NeedleState | null): void => {
    if (needle === builtNeedle) return;
    builtNeedle = needle;
    view.setNeedle(needle);
    requestDraw();
  };

  const setShown = (on: boolean): void => {
    shown = on;
    paint(toggle, on);
    area.style.display = on ? 'block' : 'none';
    for (const button of layerButtons) button.style.display = on ? '' : 'none';
    controls.enabled = on;
    if (on && !renderer) {
      renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      new ResizeObserver(resize).observe(area);
    }
    if (on) resize();
  };

  // One toggle per layer, shown while the 3D view is on (F8.4).
  const layerButtons: HTMLButtonElement[] = [];
  for (const layer of LAYERS) {
    const mesh = view.layers.get(layer.id)!;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.testid = `layer-toggle-${layer.id}`;
    button.textContent = layer.name;
    button.title = `Show or hide the ${layer.name.toLowerCase()} layer`;
    Object.assign(button.style, BUTTON_STYLE);
    paint(button, mesh.visible);
    button.addEventListener('click', () => {
      mesh.visible = !mesh.visible;
      paint(button, mesh.visible);
      requestDraw();
    });
    layerButtons.push(button);
  }
  row.append(...layerButtons);

  // The C-arm follows the live pose (owner decision 2026-11-11), not the pose of the last image.
  let builtPose: CArmPose | undefined;
  const syncPose = (pose: CArmPose): void => {
    if (pose === builtPose) return;
    builtPose = pose;
    view.setPose(pose);
    requestDraw();
  };

  // Exam mode (F8.5): the view is hidden and the toggle disabled. Leaving
  // Exam mode enables the toggle again; the view stays off until the learner
  // turns it on (owner decision 2026-11-11).
  const syncMode = (mode: Mode): void => {
    const exam = mode === 'exam';
    if (exam === toggle.disabled) return;
    toggle.disabled = exam;
    toggle.style.cursor = exam ? 'not-allowed' : 'pointer';
    toggle.style.opacity = exam ? '0.5' : '1';
    toggle.title = exam ? 'The 3D view is not available in Exam mode' : 'Show or hide the 3D see-through view';
    if (exam) setShown(false);
  };

  setShown(false);
  syncMode(store.get().mode);
  syncPose(store.get().pose);
  syncVolume(store.get().volume);
  syncNeedle(store.get().needle);
  store.subscribe((state) => {
    syncMode(state.mode);
    syncPose(state.pose);
    syncVolume(state.volume);
    syncNeedle(state.needle);
  });
  toggle.addEventListener('click', () => {
    if (!toggle.disabled) setShown(!shown);
  });

  registerDebugGetter('view3d', () => {
    const { position } = view.camera;
    const target = view.target;
    // Detector corners straight from the detector's own geometry.
    const square = view.detector.geometry.getAttribute('position');
    const corners: Vec3[] = [0, 1, 2, 3].map((i) => ({ x: square.getX(i), y: square.getY(i), z: square.getZ(i) }));
    // Hub and tip straight from the needle line's own geometry.
    const line = view.needle.geometry.getAttribute('position');
    const vertex = (i: number): Vec3 => ({ x: line.getX(i), y: line.getY(i), z: line.getZ(i) });
    const needle = view.needle.visible && line.count >= 2 ? { hub: vertex(0), tip: vertex(line.count - 1) } : null;
    return {
      shown,
      toggleEnabled: !toggle.disabled,
      objects: [view.bone, ...view.layers.values(), view.source, view.detector, view.beam, view.needle].map((object) => ({
        name: object.name,
        visible: object.visible,
        triangles: object instanceof Mesh ? triangleCount(object.geometry) : 0,
      })),
      camera: {
        position: { x: position.x, y: position.y, z: position.z },
        target: { x: target.x, y: target.y, z: target.z },
      },
      carm: {
        source: { x: view.source.position.x, y: view.source.position.y, z: view.source.position.z },
        detectorCentre: {
          x: (corners[0]!.x + corners[2]!.x) / 2,
          y: (corners[0]!.y + corners[2]!.y) / 2,
          z: (corners[0]!.z + corners[2]!.z) / 2,
        },
        detectorCorners: corners,
      },
      needle,
    };
  });
}
