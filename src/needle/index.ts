// Needle catalogue, physics and handling controls — F4, F5.
// F0 placeholder: mount() builds this zone's panel (needle-panel) with its marker.

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'needle-panel';
  panel.setAttribute('aria-label', 'Needle');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-needle';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = 'Needle';

  panel.append(marker, heading);
  element.append(panel);
}
