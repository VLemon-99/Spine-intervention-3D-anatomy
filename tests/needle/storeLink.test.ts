import { describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import { createProjection } from '../../src/core/geometry';
import { createEventBus, createStore } from '../../src/core/store';
import type { Vec3 } from '../../src/core/types';
import { skinEntry } from '../../src/needle/entry';
import { createNeedleSession } from '../../src/needle/session';
import { linkNeedleToStore } from '../../src/needle/storeLink';

const AP = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const ray = createProjection(AP).unproject({ x: 256, y: 256 });

function setUp() {
  const store = createStore();
  const bus = createEventBus();
  const volume = createPhantom();
  store.set({ volume });
  const session = createNeedleSession();
  linkNeedleToStore(session, store, bus);
  const entry = skinEntry(volume, ray) as Vec3;
  return { store, bus, volume, session, entry };
}

describe('needle store link', () => {
  it('writes the needle to the store on every change', () => {
    const { store, session, entry } = setUp();
    expect(store.get().needle).toBeNull();
    session.markEntry(entry, ray.direction);
    expect(store.get().needle).toEqual(session.toNeedleState());
    session.advance(5);
    expect(store.get().needle?.insertedDepth).toBeCloseTo(5, 6);
  });

  it('removes the needle on caseStart', () => {
    const { store, bus, session, entry } = setUp();
    session.markEntry(entry, ray.direction);
    session.advance(3);
    expect(store.get().needle).not.toBeNull();
    bus.emit('caseStart');
    expect(store.get().needle).toBeNull();
    expect(session.locked).toBe(false);
  });

  it('removes the needle when a different volume is loaded, not when the same one is put back', () => {
    const { store, volume, session, entry } = setUp();
    session.markEntry(entry, ray.direction);
    session.advance(3);
    store.set({ volume, shotCount: 1 });
    expect(store.get().needle).not.toBeNull();
    const other = createPhantom();
    store.set({ volume: other });
    expect(store.get().needle).toBeNull();
    expect(session.volume).toBe(other);
  });
});
