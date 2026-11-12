import { describe, expect, it } from 'vitest';
import { TISSUE } from '../../src/core/labels';
import type { Vec3 } from '../../src/core/types';
import { advance, createNeedle, setHubAngles, toNeedleState, withdraw, type NeedleModel } from '../../src/needle/model';
import { needleSpec, params } from '../../src/needle/data';
import { uniformVolume } from './volumes';

const muscle = uniformVolume(TISSUE.muscle, 201);
const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };
const NEEDLE = 'quincke-22g-89';

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
const tipOf = (m: NeedleModel): Vec3 => toNeedleState(m).tip;

function fresh(): NeedleModel {
  return createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 0 });
}
function deep(): NeedleModel {
  return advance(fresh(), 40, muscle).state;
}

function distanceToPolyline(points: Vec3[], p: Vec3): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const ab = sub(points[i + 1], a);
    const l2 = dot(ab, ab);
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
    best = Math.min(best, dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }));
  }
  return best;
}

describe('track memory (F4.8)', () => {
  it('the switch-over depth comes from params.json (10 mm)', () => {
    expect(params.trackMemoryDepthMm).toBe(10);
  });

  it('at 40 mm, a 5° hub change moves the tip less than 1 mm', () => {
    const before = deep();
    for (const angles of [{ pitch: 5, yaw: 0 }, { pitch: 0, yaw: -5 }, { pitch: -3, yaw: 4 }]) {
      expect(dist(tipOf(setHubAngles(before, angles)), tipOf(before))).toBeLessThan(1);
    }
  });

  it('after that hub change, advancing 5 mm more lands within 1 mm of the same advance without it', () => {
    const plain = advance(deep(), 5, muscle).state;
    const turned = advance(setHubAngles(deep(), { pitch: 5, yaw: 0 }), 5, muscle).state;
    expect(dist(tipOf(turned), tipOf(plain))).toBeLessThan(1);
  });

  it('after withdrawing to 8 mm and re-advancing to 40 mm, the new path follows the new hub angle', () => {
    const angles = { pitch: 5, yaw: 0 };
    const oldTip = tipOf(deep());
    let m = setHubAngles(deep(), angles);
    m = withdraw(m, 32);
    expect(toNeedleState(m).insertedDepth).toBeCloseTo(8, 6);
    m = advance(m, 32, muscle).state;
    const freshTip = tipOf(advance(setHubAngles(fresh(), angles), 40, muscle).state);
    expect(dist(tipOf(m), freshTip)).toBeLessThan(1);
    expect(dist(tipOf(m), oldTip)).toBeGreaterThan(2);
  });

  it('while deep, the shaft still passes within 0.01 mm of the entry point and keeps its length within 1%', () => {
    const L = needleSpec(NEEDLE).lengthMm;
    let m = deep();
    for (const angles of [{ pitch: 5, yaw: 0 }, { pitch: -8, yaw: 6 }, { pitch: 12, yaw: -10 }]) {
      m = setHubAngles(m, angles);
      m = advance(m, 2, muscle).state;
      const state = toNeedleState(m);
      expect(distanceToPolyline(state.shaft, ENTRY)).toBeLessThan(0.01);
      let total = 0;
      for (let i = 0; i + 1 < state.shaft.length; i++) total += dist(state.shaft[i + 1], state.shaft[i]);
      expect(Math.abs(total / L - 1)).toBeLessThan(0.01);
      // The outside part follows the hub angle: hub → entry along the new hub direction.
      expect(dist(state.shaft[0], ENTRY)).toBeCloseTo(L - state.insertedDepth, 6);
    }
  });

  it('at 10 mm or less the needle still pivots rigidly (lever rule)', () => {
    const shallow = advance(fresh(), 9, muscle).state;
    const moved = setHubAngles(shallow, { pitch: 5, yaw: 0 });
    // Tip moves to the opposite side of the hub by about depth × angle.
    const tipMove = dist(tipOf(moved), tipOf(shallow));
    expect(tipMove).toBeGreaterThan(0.5);
    expect(tipOf(moved).z - tipOf(shallow).z).toBeGreaterThan(0);
  });
});
