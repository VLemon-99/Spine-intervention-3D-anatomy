import { describe, expect, it } from 'vitest';
import { createTissueTracker } from '../../src/sim/tracker';
import { labelAt } from '../../src/sim/tissue';
import { createPhantom, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import { TISSUE } from '../../src/core/labels';
import type { TissueEvent, TissueEventType, Vec3 } from '../../src/core/types';
import { needleAt } from './needleStates';

const phantom = createPhantom();
const { start } = PHANTOM_TEST_POINTS.midlineLine;

const mid = (y: number): Vec3 => ({ x: start.x, y, z: start.z });

function run(tips: Vec3[], tracker = createTissueTracker()): TissueEvent[] {
  const events: TissueEvent[] = [];
  tips.forEach((tip, index) => events.push(...tracker.update(needleAt(tip), phantom, index * 0.5)));
  return events;
}

/** Tips along a straight line in 1 mm steps (both ends included). */
function line(a: Vec3, b: Vec3): Vec3[] {
  const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  const tips: Vec3[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    tips.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
  return tips;
}

const ofType = (events: TissueEvent[], type: TissueEventType) => events.filter((e) => e.type === type);

const ENTERED: Partial<Record<TissueEventType, number[]>> = {
  duralPuncture: [TISSUE.thecalSac],
  cordContact: [TISSUE.spinalCord],
  intravascular: [TISSUE.artery, TISSUE.vein],
  lossOfResistance: [TISSUE.epiduralSpace],
};

describe('safety events (F6.3)', () => {
  it('down the midline from y = 46 to y = 4: duralPuncture once, then cordContact once', () => {
    const events = run(line(mid(46), mid(4)));
    const dural = ofType(events, 'duralPuncture');
    const cord = ofType(events, 'cordContact');
    expect(dural).toHaveLength(1);
    expect(cord).toHaveLength(1);
    expect(dural[0].message).toBe('Dural puncture');
    expect(cord[0].message).toBe('Spinal cord contact');
    expect(events.indexOf(dural[0])).toBeLessThan(events.indexOf(cord[0]));
    expect(ofType(events, 'intravascular')).toHaveLength(0);
  });

  it('from the side into the artery gives exactly one intravascular event, message "Intravascular"', () => {
    const events = run(line({ x: 40, y: -28, z: 0 }, { x: 8, y: -28, z: 0 }));
    const vascular = ofType(events, 'intravascular');
    expect(vascular).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(vascular[0].message).toBe('Intravascular');
  });

  it('from the side into the vein gives exactly one intravascular event, message "Intravascular"', () => {
    const events = run(line({ x: -40, y: -28, z: 0 }, { x: -9, y: -28, z: 0 }));
    const vascular = ofType(events, 'intravascular');
    expect(vascular).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(vascular[0].message).toBe('Intravascular');
  });

  it('the intravascular message names neither artery nor vein', () => {
    const events = [
      ...run(line({ x: 40, y: -28, z: 0 }, { x: 8, y: -28, z: 0 })),
      ...run(line({ x: -40, y: -28, z: 0 }, { x: -9, y: -28, z: 0 })),
    ];
    for (const e of ofType(events, 'intravascular')) {
      expect(e.message.toLowerCase()).not.toMatch(/arter|vein|venous/);
    }
  });

  it('staying inside the thecal sac gives no further duralPuncture; leaving and re-entering gives a second', () => {
    const tracker = createTissueTracker();
    const staying = run([...line(mid(46), mid(12)), mid(11.5), mid(11), mid(10.5), mid(11), mid(12)], tracker);
    expect(ofType(staying, 'duralPuncture')).toHaveLength(1);
    // Back out into the epidural space (y = 14), then in again.
    const again = run([mid(14), mid(11)], tracker);
    expect(ofType(again, 'duralPuncture')).toHaveLength(1);
  });

  it('every event carries the time passed to update and a tip inside the tissue entered', () => {
    const tracker = createTissueTracker();
    const all: { event: TissueEvent; time: number }[] = [];
    const paths = [
      line(mid(46), mid(4)),
      line({ x: 40, y: -28, z: 0 }, { x: 8, y: -28, z: 0 }),
      line({ x: -40, y: -28, z: 0 }, { x: -9, y: -28, z: 0 }),
    ];
    let time = 0;
    for (const path of paths) {
      tracker.reset();
      for (const tip of path) {
        time += 0.1;
        for (const event of tracker.update(needleAt(tip), phantom, time)) all.push({ event, time });
      }
    }
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const { event, time: t } of all) {
      expect(event.time).toBe(t);
      const wanted = ENTERED[event.type];
      expect(wanted, event.type).toBeDefined();
      expect(wanted).toContain(labelAt(phantom, event.tip));
    }
  });
});
