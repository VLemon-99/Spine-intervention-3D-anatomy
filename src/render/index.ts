// Renderer (DRR, display, fluoro panel) — F2, F7.
// F0 placeholder: mount() builds this zone's panel (fluoro-panel) with its marker.

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

  panel.append(marker, heading);
  element.append(panel);
}
