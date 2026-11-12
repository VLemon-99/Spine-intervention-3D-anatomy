// Anatomy (region loader, landmarks) — F1.
// F0 placeholder: mount() adds this zone's marker element (hidden for now).

export { listRegions, loadRegion, PHANTOM_REGION, type LoadedRegion, type LoaderOptions } from './loadRegion';

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-anatomy';
  marker.hidden = true;
  element.append(marker);
}
