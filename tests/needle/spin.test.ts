import { describe, expect, it } from 'vitest';
import { TISSUE } from '../../src/core/labels';
import type { Vec3 } from '../../src/core/types';
import { advance, createNeedle, rotateBevel, toNeedleState, type NeedleModel } from '../../src/needle/model';
import { uniformVolume } from './volumes';

const muscle = uniformVolume(TISSUE.muscle, 201);
const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };

/** Advances a 22G Quincke 40 mm in 1 mm steps, rotating the bevel by `spinDeg` before each step; returns the tip's distance from the straight line. */
function drift(spinDeg: number): number {
  let m: NeedleModel = createNeedle({ needleId: 'quincke-22g-89', entryPoint: ENTRY, direction: DOWN, preBend: 0 });
  for (let i = 0; i < 40; i++) {
    m = rotateBevel(m, spinDeg);
    m = advance(m, 1, muscle).state;
  }
  const tip = toNeedleState(m).tip;
  expect(tip.y).toBeCloseTo(ENTRY.y - 40, 0);
  return Math.hypot(tip.x - ENTRY.x, tip.z - ENTRY.z);
}

describe('spinning while advancing gives a straighter path (F4.5)', () => {
  const noSpin = drift(0);

  it('without spin the drift is clearly measurable', () => {
    expect(noSpin).toBeGreaterThan(0.5);
  });

  it('with continuous spin (+30° per step) the drift is less than 25% of the no-spin drift at 40 mm', () => {
    expect(drift(30)).toBeLessThan(0.25 * noSpin);
  });

  it('the same holds when spinning the other way (−30° per step)', () => {
    expect(drift(-30)).toBeLessThan(0.25 * noSpin);
  });
});
