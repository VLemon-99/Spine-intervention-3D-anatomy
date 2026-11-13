import { describe, expect, it } from 'vitest';
import { createTissueTracker } from '../../src/sim/tracker';
import { createPhantom } from '../../src/core/phantom';
import type { TissueEvent, Vec3 } from '../../src/core/types';
import { needleAt } from './needleStates';

const phantom = createPhantom();

/** Runs hand-made needle states with the given boneContact flags; the tip creeps 0.1 mm each step, in muscle. */
function run(flags: (boolean | undefined)[]): TissueEvent[] {
  const tracker = createTissueTracker();
  const events: TissueEvent[] = [];
  flags.forEach((flag, i) => {
    const tip: Vec3 = { x: 0, y: 30 - i * 0.1, z: 0 };
    const needle = flag === undefined ? needleAt(tip) : needleAt(tip, { boneContact: flag });
    events.push(...tracker.update(needle, phantom, i * 2));
  });
  return events;
}

describe('bone contact (F6.3)', () => {
  it('boneContact false, true, true, false, true gives exactly two events', () => {
    const events = run([false, true, true, false, true]);
    const bone = events.filter((e) => e.type === 'boneContact');
    expect(bone).toHaveLength(2);
    expect(events).toHaveLength(2);
    expect(bone.map((e) => e.time)).toEqual([2, 8]);
    expect(bone[0].message).toBe('Bone contact');
    expect(bone[0].tip).toEqual({ x: 0, y: 30 - 0.1, z: 0 });
    expect(bone[1].tip).toEqual({ x: 0, y: 30 - 0.4, z: 0 });
  });

  it('a needle state without the field never gives a boneContact event', () => {
    const states = [undefined, undefined, undefined, undefined];
    expect(run(states).filter((e) => e.type === 'boneContact')).toEqual([]);
  });

  it('a first state already touching bone counts as a change from absent to true', () => {
    expect(run([true, true]).filter((e) => e.type === 'boneContact')).toHaveLength(1);
  });

  it('an absent field after true counts as false, so a later true fires again', () => {
    expect(run([true, undefined, true]).filter((e) => e.type === 'boneContact')).toHaveLength(2);
  });

  it('reset() forgets the flag', () => {
    const tracker = createTissueTracker();
    const tip = { x: 0, y: 30, z: 0 };
    expect(tracker.update(needleAt(tip, { boneContact: true }), phantom, 0)).toHaveLength(1);
    tracker.reset();
    expect(tracker.update(needleAt(tip, { boneContact: true }), phantom, 1)).toHaveLength(1);
  });
});
