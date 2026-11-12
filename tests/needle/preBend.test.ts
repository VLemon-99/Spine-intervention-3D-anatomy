import { describe, expect, it } from 'vitest';
import { TISSUE } from '../../src/core/labels';
import type { Vec3 } from '../../src/core/types';
import { advance, createNeedle, effectiveBend, rotateBevel, toNeedleState } from '../../src/needle/model';
import { needleSpec } from '../../src/needle/data';
import { airVolume, uniformVolume } from './volumes';

const muscle = uniformVolume(TISSUE.muscle, 201);
const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };
// Hub frame for a needle straight into the back: 12 o'clock = +z, 3 o'clock = −x.
const TWELVE: Vec3 = { x: 0, y: 0, z: 1 };
const THREE: Vec3 = { x: -1, y: 0, z: 0 };
const NEEDLE = 'quincke-22g-89';
const CANNULA = 'rf-curved-20g-100';

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

function tipAfter(preBend: number, bevel = 0, needleId = NEEDLE, mm = 40, volume = muscle): Vec3 {
  let m = createNeedle({ needleId, entryPoint: ENTRY, direction: DOWN, preBend });
  m = rotateBevel(m, bevel);
  return toNeedleState(advance(m, mm, volume).state).tip;
}

/** Extra tip displacement that the bend adds (bent minus unbent, same needle and bevel). */
function bendEffect(preBend: number, bevel = 0): Vec3 {
  return sub(tipAfter(preBend, bevel), tipAfter(0, bevel));
}

describe('pre-bent tip (F4.6)', () => {
  it('a 15° pre-bend moves the tip toward the bend (away from the notch: 6 o\'clock for a notch at 12)', () => {
    const extra = bendEffect(15);
    expect(dot(extra, TWELVE)).toBeLessThan(-0.5);
    expect(Math.abs(dot(extra, THREE))).toBeLessThan(0.05 * len(extra));
  });

  it('the extra displacement grows from 0° to 15° to 30°', () => {
    const e0 = len(bendEffect(0));
    const e15 = len(bendEffect(15));
    const e30 = len(bendEffect(30));
    expect(e0).toBeLessThan(1e-9);
    expect(e15).toBeGreaterThan(e0);
    expect(e30).toBeGreaterThan(e15);
  });

  it('rotating the bevel by 90° turns the direction of the bend\'s displacement by 90° (within 10°)', () => {
    const a = bendEffect(15, 0);
    const b = bendEffect(15, 90);
    const angleOf = (v: Vec3) => (Math.atan2(dot(v, THREE), dot(v, TWELVE)) * 180) / Math.PI;
    let turn = angleOf(b) - angleOf(a);
    turn = ((turn % 360) + 360) % 360;
    expect(Math.abs(turn - 90)).toBeLessThan(10);
  });

  it('a preBend of 45 behaves like 30, −5 like 0, and a non-number like 0', () => {
    expect(tipAfter(45)).toEqual(tipAfter(30));
    expect(tipAfter(-5)).toEqual(tipAfter(0));
    expect(tipAfter(Number.NaN)).toEqual(tipAfter(0));
    expect(tipAfter('abc' as unknown as number)).toEqual(tipAfter(0));
    const state = toNeedleState(createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 45 }));
    expect(state.preBend).toBe(30);
    expect(toNeedleState(createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: -5 })).preBend).toBe(0);
  });

  it('a bend has no effect in air', () => {
    expect(len(sub(tipAfter(30, 0, NEEDLE, 40, airVolume()), tipAfter(0, 0, NEEDLE, 40, airVolume())))).toBeLessThan(1e-9);
  });

  it('the curved-tip cannula curves by its catalogue tip curve, whatever preBend is passed', () => {
    const curve = needleSpec(CANNULA).tipCurveDeg!;
    expect(effectiveBend(needleSpec(CANNULA), 0)).toBe(curve);
    expect(effectiveBend(needleSpec(CANNULA), 25)).toBe(curve);
    expect(effectiveBend(needleSpec(NEEDLE), 25)).toBe(25);
    const state = toNeedleState(createNeedle({ needleId: CANNULA, entryPoint: ENTRY, direction: DOWN, preBend: 25 }));
    expect(state.preBend).toBe(curve);
    // Same path whatever preBend is passed, and it curves toward 6 o'clock (notch at 12).
    const tip = tipAfter(0, 0, CANNULA);
    expect(tipAfter(25, 0, CANNULA)).toEqual(tip);
    expect(dot(sub(tip, ENTRY), TWELVE)).toBeLessThan(-0.5);
  });
});
