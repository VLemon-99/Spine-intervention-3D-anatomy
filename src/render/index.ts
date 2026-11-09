// Renderer (DRR, display, fluoro panel) — F2, F7.
// mount() builds this zone's panel (fluoro-panel) with the fluoro canvas.
import { bus } from '../core/store';
import { createFluoroCanvas } from './fluoroCanvas';

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

  const imageArea = document.createElement('div');
  Object.assign(imageArea.style, { flex: '1', minHeight: '0', display: 'flex', alignItems: 'center' });

  Object.assign(panel.style, { display: 'flex', flexDirection: 'column' });
  panel.append(marker, heading, imageArea);
  element.append(panel);
  createFluoroCanvas(imageArea, bus);
}
