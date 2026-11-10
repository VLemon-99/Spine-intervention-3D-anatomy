// 3D see-through view — F8.
// F0 placeholder: mount() builds this zone's panel (view3d-panel) with its marker.

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'view3d-panel';
  panel.setAttribute('aria-label', '3D view');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-view3d';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = '3D view';

  panel.append(marker, heading);
  element.append(panel);
}
