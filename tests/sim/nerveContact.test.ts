import { describe, expect, it } from 'vitest';
import { createTissueTracker } from '../../src/sim/tracker';
import { createPhantom, createPhantomLandmarks, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import { TISSUE } from '../../src/core/labels';
import type { Landmarks, TissueEvent, Vec3, Volume } from '../../src/core/types';
import { needleAt } from './needleStates';

const phantom = createPhantom();
const landmarks = createPhantomLandmarks();

function line(a: Vec3, b: Vec3, stepMm = 1): Vec3[] {
  const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / stepMm));
  const tips: Vec3[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    tips.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
  return tips;
}

function run(tips: Vec3[], volume: Volume, marks?: Landmarks): TissueEvent[] {
  const tracker = createTissueTracker();
  const events: TissueEvent[] = [];
  tips.forEach((tip, i) => events.push(...tracker.update(needleAt(tip), volume, i, marks)));
  return events;
}

const nerve = (events: TissueEvent[]) => events.filter((e) => e.type === 'nerveContact');

/** A 21 mm muscle cube (1 mm voxels, centred on the origin) with one nerve-root voxel at the origin. */
function oneNerveVoxel(): Volume {
  const n = 21;
  const half = (n - 1) / 2;
  const labels = new Uint8Array(n * n * n).fill(TISSUE.muscle);
  labels[half + n * (half + n * half)] = TISSUE.nerveRoot;
  return {
    region: 'one-nerve-voxel',
    size: { x: n, y: n, z: n },
    spacing: { x: 1, y: 1, z: 1 },
    origin: { x: -half, y: -half, z: -half },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity: new Uint8Array(n * n * n),
    labels,
  };
}

describe('nerve contact (F6.3)', () => {
  it('a path toward the left foramen from behind gives one nerveContact: left L4', () => {
    const foramen = PHANTOM_TEST_POINTS.foramenCentres.left;
    const events = nerve(run(line({ ...foramen, y: 40 }, foramen), phantom, landmarks));
    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('L4');
    expect(events[0].side).toBe('left');
    expect(events[0].message).toBe('Paresthesia — left L4');
  });

  it('the same on the right side gives right L4', () => {
    const foramen = PHANTOM_TEST_POINTS.foramenCentres.right;
    const events = nerve(run(line({ ...foramen, y: 40 }, foramen), phantom, landmarks));
    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('L4');
    expect(events[0].side).toBe('right');
    expect(events[0].message).toBe('Paresthesia — right L4');
  });

  it('a tip 1.5 mm from the nearest nerve-root voxel centre gives no event; 0.8 mm gives one', () => {
    const volume = oneNerveVoxel();
    expect(nerve(run([{ x: 0, y: 6, z: 0 }, { x: 0, y: 1.5, z: 0 }], volume, landmarks))).toHaveLength(0);
    expect(nerve(run([{ x: 0, y: 6, z: 0 }, { x: 0, y: 0.8, z: 0 }], volume, landmarks))).toHaveLength(1);
    // Diagonal: (0.6, 0.6, 0.6) is about 1.04 mm from the voxel centre — outside; (0.5, 0.5, 0.5) is 0.87 mm — inside.
    expect(nerve(run([{ x: 6, y: 6, z: 6 }, { x: 0.6, y: 0.6, z: 0.6 }], volume, landmarks))).toHaveLength(0);
    expect(nerve(run([{ x: 6, y: 6, z: 6 }, { x: 0.5, y: 0.5, z: 0.5 }], volume, landmarks))).toHaveLength(1);
  });

  it('once per entry: staying in the zone gives no more events; leaving and coming back gives another', () => {
    const volume = oneNerveVoxel();
    const tips = [
      { x: 0, y: 6, z: 0 },
      { x: 0, y: 0.8, z: 0 },
      { x: 0, y: 0.5, z: 0 },
      { x: 0, y: 0.9, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 0, y: 0.7, z: 0 },
    ];
    expect(nerve(run(tips, volume, landmarks))).toHaveLength(2);
  });

  it('landmarks without foramina give the message "Paresthesia" with no level or side', () => {
    const noForamina: Landmarks = {
      ...landmarks,
      levels: landmarks.levels.map((level) => {
        const copy = { ...level };
        delete copy.foramenCentre;
        return copy;
      }),
    };
    const foramen = PHANTOM_TEST_POINTS.foramenCentres.left;
    for (const marks of [noForamina, undefined]) {
      const events = nerve(run(line({ ...foramen, y: 40 }, foramen), phantom, marks));
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Paresthesia');
      expect(events[0]).not.toHaveProperty('level');
      expect(events[0]).not.toHaveProperty('side');
    }
  });

  it('carries the time passed to update and a tip within 1 mm of a nerve-root voxel', () => {
    const foramen = PHANTOM_TEST_POINTS.foramenCentres.left;
    const events = nerve(run(line({ ...foramen, y: 40 }, foramen), phantom, landmarks));
    expect(Number.isInteger(events[0].time)).toBe(true);
    expect(events[0].time).toBeGreaterThan(0);
    // Phantom nerve root at x = 13: voxels y 3–7 on z = 0, so the zone starts at y = 8.
    expect(events[0].tip.y).toBeLessThanOrEqual(8);
    expect(events[0].tip.y).toBeGreaterThan(7);
  });

  it('the midline path (no nerve root near it) gives no nerveContact', () => {
    const { start, end } = PHANTOM_TEST_POINTS.midlineLine;
    expect(nerve(run(line(start, { ...end, y: 4 }), phantom, landmarks))).toHaveLength(0);
  });
});
