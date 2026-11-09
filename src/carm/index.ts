// C-arm and table controls, exposure, counters — F3.
// F0 placeholder: mount() builds this zone's panel (carm-panel) with its marker.

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'carm-panel';
  panel.setAttribute('aria-label', 'C-arm');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-carm';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = 'C-arm';

  panel.append(marker, heading);
  element.append(panel);
}
