// Renderer (DRR, display, fluoro panel) — F2, F7.
// mount() builds this zone's panel (fluoro-panel): the fluoro canvas with the
// display controls beside it and the pose text over its top-left corner.
import { bus, store } from '../core/store';
import { createControls } from './controls';
import { createFluoroCanvas } from './fluoroCanvas';
import { createPoseReadout } from './poseReadout';
import { renderSettings } from './settings';

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'fluoro-panel';
  panel.setAttribute('aria-label', 'Fluoro image');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-render';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = 'Fluoro image';

  // The picture on the left, the controls in a narrow column on its right.
  const body = document.createElement('div');
  Object.assign(body.style, { flex: '1', minHeight: '0', display: 'flex', gap: '8px' });
  const imageArea = document.createElement('div');
  Object.assign(imageArea.style, { flex: '1', minWidth: '0', minHeight: '0', display: 'flex', alignItems: 'center' });
  body.append(imageArea);

  Object.assign(panel.style, { display: 'flex', flexDirection: 'column' });
  panel.append(marker, heading, body);
  element.append(panel);
  const canvas = createFluoroCanvas(imageArea, store, bus, renderSettings);
  if (canvas) createPoseReadout(imageArea, canvas, store);
  createControls(body, renderSettings);
}
