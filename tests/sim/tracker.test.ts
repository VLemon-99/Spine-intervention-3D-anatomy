import { describe, expect, it } from 'vitest';
import { createTissueTracker } from '../../src/sim/tracker';
import { createPhantom, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import type { TissueEvent, Vec3 } from '../../src/core/types';
import { needleAt } from './needleStates';
import { labelAt } from '../../src/sim/tissue';
import { TISSUE } from '../../src/core/labels';

const phantom = createPhantom();
const { start } = PHANTOM_TEST_POINTS.midlineLine;

/** Midline tip at a given y. */
const mid = (y: number): Vec3 => ({ x: start.x, y, z: start.z });

/** Runs a tracker over tip positions (time = index), collecting every event. */
function run(tips: Vec3[], tracker = createTissueTracker()): TissueEvent[] {
  const events: TissueEvent[] = [];
  tips.forEach((tip, index) => events.push(...tracker.update(needleAt(tip), phantom, index)));
  return events;
}

/** Tips from y = from to y = to (inclusive) in 1 mm steps along the midline. */
function midlineSteps(from: number, to: number): Vec3[] {
  const tips: Vec3[] = [];
  const dir = Math.sign(to - from);
  for (let y = from; dir > 0 ? y <= to : y >= to; y += dir) tips.push(mid(y));
  return tips;
}

describe('loss of resistance (F6.2)', () => {
  it('the midline path from y = 46 to y = 10 in 1 mm steps gives one event, at a tip y between 14 and 16', () => {
    const events = run(midlineSteps(start.y, 10));
    const lor = events.filter((e) => e.type === 'lossOfResistance');
    expect(lor).toHaveLength(1);
    expect(lor[0].message).toBe('Loss of resistance');
    expect(lor[0].tip.y).toBeGreaterThanOrEqual(14);
    expect(lor[0].tip.y).toBeLessThanOrEqual(16);
    expect(lor[0].tip.x).toBe(0);
    expect(lor[0].tip.z).toBe(0);
  });

  it('carries the time passed to update', () => {
    const tracker = createTissueTracker();
    expect(tracker.update(needleAt(mid(25)), phantom, 1.5)).toEqual([]);
    const events = tracker.update(needleAt(mid(14)), phantom, 2.75);
    expect(events).toHaveLength(1);
    expect(events[0].time).toBe(2.75);
  });

  it('the same path in one single 36 mm step also gives exactly one event', () => {
    const events = run([mid(46), mid(10)]);
    const lor = events.filter((e) => e.type === 'lossOfResistance');
    expect(lor).toHaveLength(1);
    expect(lor[0].tip.y).toBeGreaterThanOrEqual(14);
    expect(lor[0].tip.y).toBeLessThanOrEqual(16);
  });

  it('withdrawing back into the ligamentum flavum and advancing again gives a second event', () => {
    const tracker = createTissueTracker();
    const tips = [...midlineSteps(46, 14), ...midlineSteps(15, 19), ...midlineSteps(18, 12)];
    const lor = run(tips, tracker).filter((e) => e.type === 'lossOfResistance');
    expect(lor).toHaveLength(2);
  });

  it('staying in the epidural space gives no further event', () => {
    const lor = run([...midlineSteps(46, 14), mid(14), mid(13.5), mid(14.5)]).filter(
      (e) => e.type === 'lossOfResistance',
    );
    expect(lor).toHaveLength(1);
  });

  it('a path through muscle only gives no event', () => {
    // On the midline the phantom is muscle from y = 37 down to y = 24 (above the ligamentum flavum).
    const tips = midlineSteps(37, 24);
    for (const tip of tips) expect(labelAt(phantom, tip)).toBe(TISSUE.muscle);
    expect(run(tips)).toEqual([]);
  });

  it('is deterministic: the same inputs give the same events', () => {
    const tips = [...midlineSteps(46, 14), ...midlineSteps(15, 19), ...midlineSteps(18, 10)];
    expect(run(tips)).toEqual(run(tips));
  });

  it('starts with no previous tip, and reset() forgets it', () => {
    const tracker = createTissueTracker();
    // First update ever: a tip already in the epidural space is not a crossing.
    expect(tracker.update(needleAt(mid(14)), phantom, 0)).toEqual([]);
    tracker.update(needleAt(mid(19)), phantom, 1);
    tracker.reset();
    // After reset the previous tip (in the ligamentum flavum) is forgotten.
    expect(tracker.update(needleAt(mid(14)), phantom, 2)).toEqual([]);
  });
});
