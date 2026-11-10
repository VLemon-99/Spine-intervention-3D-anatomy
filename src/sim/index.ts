// Sim (tissue feel, events, aspiration) — F6.
// F0 placeholder: mount() adds this zone's marker element (hidden for now).

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-sim';
  marker.hidden = true;
  element.append(marker);
}
