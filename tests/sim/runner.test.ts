import { describe, expect, it } from 'vitest';
import { connectSim } from '../../src/sim/runner';
import { createEventBus, createStore } from '../../src/core/store';
import { createPhantom, createPhantomLandmarks, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import type { TissueEvent, Vec3 } from '../../src/core/types';
import { needleAt } from './needleStates';

const phantom = createPhantom();
const landmarks = createPhantomLandmarks();
const { start } = PHANTOM_TEST_POINTS.midlineLine;
const mid = (y: number): Vec3 => ({ x: start.x, y, z: start.z });

/** A test store with the phantom, a test bus collecting tissueEvents, and a fake clock (seconds). */
function setUp(startSeconds = 100) {
  const store = createStore();
  store.set({ volume: phantom, landmarks });
  const bus = createEventBus();
  const emitted: TissueEvent[] = [];
  bus.on('tissueEvent', (event) => emitted.push(event));
  let now = startSeconds;
  const clock = { set: (seconds: number) => (now = seconds) };
  const sim = connectSim(store, bus, () => now);
  return { store, bus, emitted, clock, sim };
}

describe('sim runner (F6.2, F6.3)', () => {
  it('needle states along the phantom midline emit lossOfResistance then duralPuncture, with the fake clock times', () => {
    const { store, emitted, clock, sim } = setUp(100);
    for (let y = 46; y >= 10; y -= 1) {
      clock.set(100 + (46 - y) * 0.5);
      store.set({ needle: needleAt(mid(y)) });
    }
    expect(emitted.map((e) => e.type)).toEqual(['lossOfResistance', 'duralPuncture']);
    // Loss of resistance at y = 15 (step 31), dural puncture at y = 12 (step 34); time counts from connecting.
    expect(emitted[0].time).toBe(15.5);
    expect(emitted[1].time).toBe(17);
    expect(sim.events()).toEqual(emitted);
  });

  it('keeps this attempt\'s events oldest first, as copies', () => {
    const { store, sim } = setUp();
    for (let y = 46; y >= 10; y -= 1) store.set({ needle: needleAt(mid(y)) });
    const events = sim.events();
    expect(events.map((e) => e.type)).toEqual(['lossOfResistance', 'duralPuncture']);
    events.pop();
    expect(sim.events()).toHaveLength(2);
  });

  it('a needle state with boneContact true emits one boneContact; repeating it with the flag still true emits nothing more', () => {
    const { store, emitted } = setUp();
    store.set({ needle: needleAt(mid(30), { boneContact: true }) });
    store.set({ needle: needleAt(mid(30), { boneContact: true }) });
    store.set({ needle: needleAt(mid(29.9), { boneContact: true }) });
    expect(emitted.filter((e) => e.type === 'boneContact')).toHaveLength(1);
    expect(emitted).toHaveLength(1);
  });

  it('caseStart clears the stored events and restarts the clock', () => {
    const { store, bus, clock, sim, emitted } = setUp(100);
    for (let y = 46; y >= 10; y -= 1) store.set({ needle: needleAt(mid(y)) });
    expect(sim.events()).toHaveLength(2);
    clock.set(200);
    bus.emit('caseStart');
    expect(sim.events()).toEqual([]);
    // The tracker was reset too: the next state is a fresh start, not a crossing.
    store.set({ needle: needleAt(mid(19)) });
    clock.set(203.25);
    store.set({ needle: needleAt(mid(14)) });
    expect(sim.events()).toHaveLength(1);
    expect(sim.events()[0].time).toBe(3.25);
    expect(emitted).toHaveLength(3);
  });

  it('a needle going to null resets the tracker but keeps the events', () => {
    const { store, sim } = setUp();
    store.set({ needle: needleAt(mid(19)) });
    store.set({ needle: null });
    // Without a reset, 19 → 14 would cross into the epidural space.
    store.set({ needle: needleAt(mid(14)) });
    expect(sim.events()).toEqual([]);
    store.set({ needle: needleAt(mid(19)) });
    store.set({ needle: needleAt(mid(14)) });
    expect(sim.events()).toHaveLength(1);
    store.set({ needle: null });
    expect(sim.events()).toHaveLength(1);
  });

  it('no needle: no events and tipTissue null', () => {
    const { store, emitted, sim } = setUp();
    store.set({ pose: { ...store.get().pose, oblique: 10 } });
    expect(emitted).toEqual([]);
    expect(sim.events()).toEqual([]);
    expect(sim.tipTissue()).toBeNull();
  });

  it('tipTissue gives the tissue and resistance at the tip of the store\'s needle', () => {
    const { store, sim } = setUp();
    store.set({ needle: needleAt(mid(14)) });
    expect(sim.tipTissue()?.key).toBe('epiduralSpace');
    store.set({ needle: needleAt(mid(19)) });
    expect(sim.tipTissue()?.key).toBe('ligamentumFlavum');
    expect(sim.tipTissue()?.resistance).toBeGreaterThan(0.5);
  });

  it('a needle without a volume gives no events and tipTissue null', () => {
    const store = createStore();
    const bus = createEventBus();
    const sim = connectSim(store, bus, () => 0);
    store.set({ needle: needleAt(mid(19)) });
    store.set({ needle: needleAt(mid(14)) });
    expect(sim.events()).toEqual([]);
    expect(sim.tipTissue()).toBeNull();
  });

  it('passes the store landmarks on, so nerve contact names level and side', () => {
    const { store, emitted } = setUp();
    const foramen = PHANTOM_TEST_POINTS.foramenCentres.left;
    for (let y = 40; y >= 5; y -= 1) store.set({ needle: needleAt({ ...foramen, y }) });
    const nerve = emitted.filter((e) => e.type === 'nerveContact');
    expect(nerve).toHaveLength(1);
    expect(nerve[0].message).toBe('Paresthesia — left L4');
  });

  it('disconnect() stops watching the store and the bus', () => {
    const { store, emitted, sim } = setUp();
    sim.disconnect();
    for (let y = 46; y >= 10; y -= 1) store.set({ needle: needleAt(mid(y)) });
    expect(emitted).toEqual([]);
  });
});
