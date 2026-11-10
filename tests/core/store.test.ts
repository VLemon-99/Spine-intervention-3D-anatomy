import { describe, expect, it, vi } from 'vitest';
import { createEventBus, createStore } from '../../src/core/store';
import type { TissueEvent } from '../../src/core/types';

describe('store', () => {
  it('starts with the default pose, zero counters, free play and nothing loaded', () => {
    const state = createStore().get();
    expect(state.pose).toEqual({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
    expect(state.shotCount).toBe(0);
    expect(state.fluoroTimeSeconds).toBe(0);
    expect(state.lastImagePose).toBeNull();
    expect(state.mode).toBe('freeplay');
    expect(state.volume).toBeNull();
    expect(state.landmarks).toBeNull();
    expect(state.needle).toBeNull();
    expect(state.contrast).toBeNull();
  });

  it('two stores do not share state', () => {
    const a = createStore();
    const b = createStore();
    a.set({ shotCount: 3 });
    expect(b.get().shotCount).toBe(0);
  });

  it('set() updates the state and calls each subscriber once per change', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ shotCount: 1, mode: 'practice' });
    expect(store.get().shotCount).toBe(1);
    expect(store.get().mode).toBe('practice');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(store.get());
    store.set({ fluoroTimeSeconds: 2.5 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('set() leaves other fields alone', () => {
    const store = createStore();
    store.set({ shotCount: 4 });
    store.set({ mode: 'exam' });
    expect(store.get().shotCount).toBe(4);
  });

  it('does not call subscribers when nothing changes', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ shotCount: 0 });
    store.set({});
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing stops the calls', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set({ shotCount: 1 });
    unsubscribe();
    store.set({ shotCount: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('event bus', () => {
  const tissueEvent: TissueEvent = {
    type: 'boneContact',
    time: 3.2,
    tip: { x: 1, y: 2, z: 3 },
    message: 'Bone contact',
  };

  it.each(['exposure', 'caseStart'] as const)('"%s" reaches every listener, and none after off()', (name) => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(name, a);
    bus.on(name, b);
    bus.emit(name);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    bus.off(name, a);
    bus.off(name, b);
    bus.emit(name);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('"tissueEvent" reaches every listener with the TissueEvent unchanged, and none after off()', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('tissueEvent', a);
    bus.on('tissueEvent', b);
    bus.emit('tissueEvent', tissueEvent);
    expect(a).toHaveBeenCalledWith(tissueEvent);
    expect(a.mock.calls[0]?.[0]).toBe(tissueEvent);
    expect(b).toHaveBeenCalledWith(tissueEvent);
    bus.off('tissueEvent', a);
    bus.off('tissueEvent', b);
    bus.emit('tissueEvent', tissueEvent);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('a listener for one event does not hear another', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on('exposure', listener);
    bus.emit('caseStart');
    expect(listener).not.toHaveBeenCalled();
  });
});
