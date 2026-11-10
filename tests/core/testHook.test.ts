import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registerDebugGetter } from '../../src/core/debugRegistry';
import { createPhantom } from '../../src/core/phantom';
import { createStore } from '../../src/core/store';
import { installTestHook, type SimHook } from '../../src/core/testHook';

const install = (store = createStore()): { target: { __sim?: SimHook }; store: ReturnType<typeof createStore> } => {
  const target: { __sim?: SimHook } = {};
  installTestHook(target, store);
  return { target, store };
};

describe('test hook (plain target object, no browser page)', () => {
  it('getState() reports pose, shot count, last image pose and the volume', () => {
    const { target, store } = install();
    expect(target.__sim?.getState()).toEqual({
      pose: { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
      shotCount: 0,
      lastImagePose: null,
      volume: null,
    });
    const phantom = createPhantom();
    store.set({ volume: phantom, shotCount: 2 });
    expect(target.__sim?.getState().volume).toEqual({ region: 'phantom', size: phantom.size });
    expect(target.__sim?.getState().shotCount).toBe(2);
  });

  it('changing the returned state does not change the store', () => {
    const { target, store } = install();
    const state = target.__sim?.getState();
    if (!state) throw new Error('no __sim');
    state.pose.oblique = 45;
    state.shotCount = 9;
    expect(store.get().pose.oblique).toBe(0);
    expect(store.get().shotCount).toBe(0);
  });

  it('shows getters registered through the registration function, as read-only copies', () => {
    const { target } = install();
    const zoneState = { depth: 12, events: ['boneContact'] };
    registerDebugGetter('exampleZoneState', () => zoneState);
    const copy = target.__sim?.exampleZoneState?.() as typeof zoneState;
    expect(copy).toEqual(zoneState);
    copy.depth = 99;
    copy.events.push('changed');
    expect(zoneState).toEqual({ depth: 12, events: ['boneContact'] });
  });

  it('keeps the registration file free of the text "__sim"', () => {
    const file = fileURLToPath(new URL('../../src/core/debugRegistry.ts', import.meta.url));
    expect(readFileSync(file, 'utf8')).not.toContain('__sim');
  });
});
