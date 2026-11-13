// Connects the region loader to the shared store and bus (SPEC F1.6):
// fills store.regions from the manifest and loads a region on 'regionRequest'.
// Loading does not take an image: the new region shows on the next image.
import { registerDebugGetter } from '../core/debugRegistry';
import type { EventBus, Store } from '../core/store';
import type { RegionEntry } from '../core/types';
import { listRegions, loadRegion, type LoaderOptions } from './loadRegion';

const TITLES: Readonly<Record<string, string>> = {
  cervical: 'Cervical',
  thoracic: 'Thoracic',
  lumbosacral: 'Lumbosacral',
};

/** The manifest's region names as store entries, with the titles shown in the region picker. */
export function regionEntries(names: readonly string[]): RegionEntry[] {
  return names.filter((name) => Object.hasOwn(TITLES, name)).map((name) => ({ name, title: TITLES[name] }));
}

export interface AnatomyStatus {
  loading: boolean;
  /** Message of the last failed load, or null. */
  lastError: string | null;
}

/**
 * Fills store.regions, then answers 'regionRequest' events. A name not in
 * store.regions is ignored; a failed load keeps the current volume. Returns
 * a function giving the current status, and a promise for the initial listing.
 */
export function wireRegions(store: Store, bus: EventBus, options: LoaderOptions = {}): { status: () => AnatomyStatus; ready: Promise<void> } {
  const status: AnatomyStatus = { loading: false, lastError: null };
  let latest = 0;

  const ready = listRegions(options)
    .then((regions) => store.set({ regions: regionEntries(regions.map((r) => r.name)) }))
    .catch((e: unknown) => {
      status.lastError = (e as Error).message;
    });

  bus.on('regionRequest', (name) => {
    if (!store.get().regions.some((r) => r.name === name)) return;
    const request = ++latest;
    status.loading = true;
    loadRegion(name, options)
      .then(({ volume, landmarks }) => {
        if (request !== latest) return; // a newer request wins
        store.set({ volume, landmarks });
        status.lastError = null;
      })
      .catch((e: unknown) => {
        if (request === latest) status.lastError = (e as Error).message;
      })
      .finally(() => {
        if (request === latest) status.loading = false;
      });
  });

  return { status: () => ({ ...status }), ready };
}

/** Registers window.__sim.anatomy() in development and test builds. */
export function registerAnatomyDebug(status: () => AnatomyStatus): void {
  registerDebugGetter('anatomy', status);
}
