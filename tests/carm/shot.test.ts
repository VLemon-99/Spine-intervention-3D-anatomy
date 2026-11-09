import { describe, expect, it, vi } from 'vitest';
import { takeShot } from '../../src/carm/shot';
import { createEventBus, createStore } from '../../src/core/store';

describe('takeShot (no browser page)', () => {
  it('emits exactly one exposure event and raises the shot count by 1', () => {
    const store = createStore();
    const bus = createEventBus();
    const exposure = vi.fn();
    bus.on('exposure', exposure);
    takeShot(store, bus);
    expect(exposure).toHaveBeenCalledTimes(1);
    expect(store.get().shotCount).toBe(1);
  });

  it('records the current pose as the last image pose (a copy)', () => {
    const store = createStore();
    const bus = createEventBus();
    store.set({ pose: { oblique: 25, tilt: -5, tableLeftRight: 10, tableHeadFoot: 0, tableHeight: -3 } });
    takeShot(store, bus);
    expect(store.get().lastImagePose).toEqual(store.get().pose);
    expect(store.get().lastImagePose).not.toBe(store.get().pose);
  });

  it('updates the store before the exposure event, so listeners see the new state', () => {
    const store = createStore();
    const bus = createEventBus();
    let seen = -1;
    bus.on('exposure', () => {
      seen = store.get().shotCount;
    });
    takeShot(store, bus);
    expect(seen).toBe(1);
  });
});
