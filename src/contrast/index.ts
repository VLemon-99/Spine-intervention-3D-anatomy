// Contrast (spread and washout) — F9.
// F0 placeholder: mount() adds this zone's marker element (hidden for now).

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-contrast';
  marker.hidden = true;
  element.append(marker);
}
