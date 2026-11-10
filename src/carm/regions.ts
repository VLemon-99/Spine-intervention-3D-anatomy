// Region picker (docs/SPEC.md F3.7): a drop-down showing the anatomy region
// that is loaded. regionEntries() is a plain function so it can be unit-tested
// and reused when real regions are on offer (F3-S10). Switching regions is
// not part of this story: the picker only shows what is loaded.
import type { Store } from '../core/store';
import type { RegionEntry } from '../core/types';

/** Titles for loaded regions that are not in the store's list (e.g. the synthetic phantom). */
const KNOWN_TITLES: Readonly<Record<string, string>> = { phantom: 'Phantom' };

/** The picker's entries: the regions on offer, plus the loaded region if it is not among them. */
export function regionEntries(regions: readonly RegionEntry[], loadedName: string | null): RegionEntry[] {
  const entries = regions.map((r) => ({ name: r.name, title: r.title }));
  if (loadedName !== null && !entries.some((e) => e.name === loadedName)) {
    entries.push({ name: loadedName, title: KNOWN_TITLES[loadedName] ?? loadedName });
  }
  return entries;
}

/** Build the region picker, kept in step with the store's regions and loaded volume. */
export function buildRegionPicker(store: Store): HTMLSelectElement {
  const select = document.createElement('select');
  select.dataset.testid = 'region-picker';
  select.setAttribute('aria-label', 'Anatomy region');
  select.title = 'Anatomy region';
  Object.assign(select.style, { minHeight: '44px', minWidth: '44px', fontSize: '15px' });

  let shownRegions: readonly RegionEntry[] | null = null;
  let shownLoaded: string | null | undefined;
  const update = (): void => {
    const { regions, volume } = store.get();
    const loaded = volume?.region ?? null;
    if (regions === shownRegions && loaded === shownLoaded) return;
    shownRegions = regions;
    shownLoaded = loaded;
    select.replaceChildren(
      ...regionEntries(regions, loaded).map(({ name, title }) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = title;
        option.selected = name === loaded;
        return option;
      }),
    );
    if (loaded !== null) select.value = loaded;
  };
  store.subscribe(update);
  update();
  return select;
}
