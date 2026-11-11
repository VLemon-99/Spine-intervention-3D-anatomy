import { describe, expect, it } from 'vitest';
import { TISSUE } from '../../src/core/labels';
import type { Vec3 } from '../../src/core/types';
import { advance, createNeedle, rotateBevel, toNeedleState, type NeedleModel } from '../../src/needle/model';
import { needleSpec } from '../../src/needle/data';
import { airVolume, uniformVolume } from './volumes';

const muscle = uniformVolume(TISSUE.muscle, 201);
const air = airVolume();
const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };
const NEEDLE = 'quincke-22g-89';
// Hub frame for a needle going straight down into the back: 12 o'clock = head (+z), 3 o'clock = patient's right (−x).
const TWELVE: Vec3 = { x: 0, y: 0, z: 1 };
const THREE: Vec3 = { x: -1, y: 0, z: 0 };

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

/** The tip's offset from the straight line through the entry point along DOWN. */
function offsetFromLine(tip: Vec3): Vec3 {
  const d = sub(tip, ENTRY);
  const along = dot(d, DOWN);
  return sub(d, { x: DOWN.x * along, y: DOWN.y * along, z: DOWN.z * along });
}

function run(bevel: number, volume = muscle, mm = 40): { model: NeedleModel; offset: Vec3 } {
  let m = createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 0 });
  m = rotateBevel(m, bevel);
  m = advance(m, mm, volume).state;
  return { model: m, offset: offsetFromLine(toNeedleState(m).tip) };
}

function distanceToPolyline(points: Vec3[], p: Vec3): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const ab = sub(points[i + 1], a);
    const l2 = dot(ab, ab);
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
    best = Math.min(best, len(sub(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t })));
  }
  return best;
}

describe('bevel drift (F4.3)', () => {
  it('notch at 12 o\'clock: the tip drifts toward 6 o\'clock by more than 0.5 mm', () => {
    const { offset } = run(0);
    expect(dot(offset, TWELVE)).toBeLessThan(-0.5);
    expect(Math.abs(dot(offset, THREE))).toBeLessThan(0.05 * len(offset));
  });

  it('bevel rotated 180°: the drift goes toward 12 o\'clock, of the same size within 10%', () => {
    const up = run(0).offset;
    const down = run(180).offset;
    expect(dot(down, TWELVE)).toBeGreaterThan(0.5);
    expect(Math.abs(len(down) / len(up) - 1)).toBeLessThan(0.1);
  });

  it('notch at 3 o\'clock: the drift goes toward 9 o\'clock', () => {
    const { offset } = run(90);
    expect(dot(offset, THREE)).toBeLessThan(-0.5);
    expect(Math.abs(dot(offset, TWELVE))).toBeLessThan(0.05 * len(offset));
  });

  it('rotateBevel turns the notch: bevelAngle reports the clock-face angle, kept between 0 and 360', () => {
    let m = createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 0 });
    m = rotateBevel(m, 90);
    expect(toNeedleState(m).bevelAngle).toBeCloseTo(90, 9);
    m = rotateBevel(m, -135);
    expect(toNeedleState(m).bevelAngle).toBeCloseTo(315, 9);
    m = rotateBevel(m, 405);
    expect(toNeedleState(m).bevelAngle).toBeCloseTo(0, 9);
  });

  it('the bent shaft still passes within 0.01 mm of the entry point and keeps its length within 1%', () => {
    for (const bevel of [0, 90, 225]) {
      const state = toNeedleState(run(bevel).model);
      expect(distanceToPolyline(state.shaft, ENTRY)).toBeLessThan(0.01);
      let total = 0;
      for (let i = 0; i + 1 < state.shaft.length; i++) total += len(sub(state.shaft[i + 1], state.shaft[i]));
      expect(Math.abs(total / needleSpec(NEEDLE).lengthMm - 1)).toBeLessThan(0.01);
    }
  });

  it('the inserted part follows the path the tip took (it is not a straight line)', () => {
    const state = toNeedleState(run(0).model);
    const mid = state.shaft[Math.floor(state.shaft.length / 2)];
    const tipOffset = len(offsetFromLine(state.tip));
    const midOffset = len(offsetFromLine(mid));
    expect(midOffset).toBeGreaterThan(0);
    expect(midOffset).toBeLessThan(tipOffset * 0.6); // a curve bends more toward its end
  });

  it('in the all-air volume the needle stays straight', () => {
    for (const bevel of [0, 90, 180]) {
      expect(len(run(bevel, air).offset)).toBeLessThan(0.01);
    }
  });
});
