// Anatomy (region loader, landmarks) — F1.
// mount() adds this zone's (hidden) marker element, lists the manifest's regions
// in the store and loads a region when the region picker asks for one.
import { bus, store } from '../core/store';
import { registerAnatomyDebug, wireRegions } from './regionWiring';

export { listRegions, loadRegion, PHANTOM_REGION, type LoadedRegion, type LoaderOptions } from './loadRegion';
export { regionEntries } from './regionWiring';

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-anatomy';
  marker.hidden = true;
  element.append(marker);
  registerAnatomyDebug(wireRegions(store, bus).status);
}
