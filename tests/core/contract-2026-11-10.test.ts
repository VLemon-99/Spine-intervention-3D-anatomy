// Shared-contract additions approved by the owner on 2026-11-10
// (docs/DECISIONS.md): image kind, region list + region request, sacrum and
// iliac crest landmarks, and the shared shortcut list for the help overlay.
import { describe, expect, it, vi } from 'vitest';
import { createEventBus, createStore } from '../../src/core/store';
import { createShortcutList } from '../../src/core/shortcuts';
import { createPhantomLandmarks } from '../../src/core/phantom';
import type { ImageKind, Landmarks, RegionEntry } from '../../src/core/types';

const p = (x: number, y: number, z: number) => ({ x, y, z });

describe('store: image kind and region list', () => {
  it('starts with no image kind and an empty region list', () => {
    const state = createStore().get();
    expect(state.lastImageKind).toBeNull();
    expect(state.regions).toEqual([]);
  });

  it('holds the kind of the image on screen and the regions on offer', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const kind: ImageKind = 'fluoro';
    const regions: RegionEntry[] = [{ name: 'lumbosacral', title: 'Lumbosacral' }];
    store.set({ lastImageKind: kind });
    store.set({ regions });
    expect(store.get().lastImageKind).toBe('fluoro');
    expect(store.get().regions).toEqual(regions);
    expect(listener).toHaveBeenCalledTimes(2);
    // @ts-expect-error only 'shot', 'fluoro' or null
    store.set({ lastImageKind: 'cine' });
  });
});

describe('bus: regionRequest', () => {
  it('reaches every listener with the region name, and none after off()', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('regionRequest', a);
    bus.on('regionRequest', b);
    bus.emit('regionRequest', 'lumbosacral');
    expect(a).toHaveBeenCalledWith('lumbosacral');
    expect(b).toHaveBeenCalledWith('lumbosacral');
    bus.off('regionRequest', a);
    bus.emit('regionRequest', 'cervical');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe('landmarks: sacrum and iliac crests', () => {
  it('a region may carry sacrum and iliac crest landmarks; the phantom has neither', () => {
    const phantom = createPhantomLandmarks();
    expect(phantom.sacrum).toBeUndefined();
    expect(phantom.iliacCrest).toBeUndefined();
    const withPelvis: Landmarks = {
      ...phantom,
      sacrum: {
        superiorEndplate: { centre: p(0, -10, -40), normal: p(0, 0, 1) },
        superiorArticularProcessTip: { left: p(15, 18, -30), right: p(-15, 18, -30) },
      },
      iliacCrest: { left: p(120, 10, 5), right: p(-120, 10, 5) },
    };
    expect(withPelvis.sacrum?.superiorArticularProcessTip.left.x).toBeGreaterThan(0);
    expect(withPelvis.iliacCrest?.right.x).toBeLessThan(0);
  });
});

describe('shortcut list', () => {
  it('lists groups in the order they were first registered, as copies', () => {
    const list = createShortcutList();
    list.register('C-arm', [{ keys: 'J / L', action: 'Oblique left / right' }]);
    list.register('Needle', [{ keys: 'W / S', action: 'Advance / withdraw' }]);
    const groups = list.list();
    expect(groups.map((g) => g.group)).toEqual(['C-arm', 'Needle']);
    groups[0]?.entries.push({ keys: 'X', action: 'changed' });
    expect(list.list()[0]?.entries).toHaveLength(1);
  });

  it('registering a group again replaces its entries and keeps its place', () => {
    const list = createShortcutList();
    list.register('C-arm', [{ keys: 'J', action: 'old' }]);
    list.register('Needle', [{ keys: 'W', action: 'Advance' }]);
    list.register('C-arm', [{ keys: 'L', action: 'new' }]);
    expect(list.list()).toEqual([
      { group: 'C-arm', entries: [{ keys: 'L', action: 'new' }] },
      { group: 'Needle', entries: [{ keys: 'W', action: 'Advance' }] },
    ]);
  });

  it('tells subscribers about each registration until they unsubscribe', () => {
    const list = createShortcutList();
    const listener = vi.fn();
    const stop = list.subscribe(listener);
    list.register('C-arm', []);
    stop();
    list.register('Needle', []);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
