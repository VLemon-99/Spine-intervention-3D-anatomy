import { describe, expect, it } from 'vitest';
import { formatFluoroTime, resetCounters, resetCountersOnCaseStart } from '../../src/carm/counters';
import { takeShot } from '../../src/carm/shot';
import { createEventBus, createStore } from '../../src/core/store';

const pose = { oblique: 12, tilt: -7, tableLeftRight: 30, tableHeadFoot: -40, tableHeight: 5 };

describe('counter reset on a new case (F3.6)', () => {
  it("a 'caseStart' event sets shot count and fluoro time to 0 and leaves the pose unchanged", () => {
    const store = createStore();
    const bus = createEventBus();
    resetCountersOnCaseStart(store, bus);
    store.set({ pose });
    takeShot(store, bus);
    takeShot(store, bus);
    store.set({ fluoroTimeSeconds: 3.4 });
    expect(store.get().shotCount).toBe(2);

    bus.emit('caseStart');
    expect(store.get().shotCount).toBe(0);
    expect(store.get().fluoroTimeSeconds).toBe(0);
    expect(store.get().pose).toEqual(pose);
  });

  it('resetCounters does the same as a plain function', () => {
    const store = createStore();
    store.set({ pose, shotCount: 5, fluoroTimeSeconds: 1.25 });
    resetCounters(store);
    expect(store.get()).toMatchObject({ shotCount: 0, fluoroTimeSeconds: 0, pose });
  });

  it('stops listening after the returned function is called', () => {
    const store = createStore();
    const bus = createEventBus();
    const stop = resetCountersOnCaseStart(store, bus);
    store.set({ shotCount: 3 });
    stop();
    bus.emit('caseStart');
    expect(store.get().shotCount).toBe(3);
  });
});

describe('formatFluoroTime', () => {
  it('shows seconds with one decimal', () => {
    expect(formatFluoroTime(0)).toBe('0.0 s');
    expect(formatFluoroTime(2.04)).toBe('2.0 s');
    expect(formatFluoroTime(12.36)).toBe('12.4 s');
  });
});
