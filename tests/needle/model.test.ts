import { describe, expect, it } from 'vitest';
import {
  advance,
  createNeedle,
  setHubAngles,
  toNeedleState,
  withdraw,
  type NeedleModel,
} from '../../src/needle/model';
import { needleSpec } from '../../src/needle/data';
import type { Vec3 } from '../../src/core/types';
import { airVolume } from './volumes';

const air = airVolume();
const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 }; // straight into the prone patient's back
const NEEDLE = 'quincke-22g-89';

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

/** Distance from point p to the polyline's closest segment. */
function distanceToPolyline(points: Vec3[], p: Vec3): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const ab = sub(points[i + 1], a);
    const l2 = dot(ab, ab);
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
    best = Math.min(best, len(sub(p, q)));
  }
  return best;
}

function shaftLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) total += len(sub(points[i + 1], points[i]));
  return total;
}

function newNeedle(): NeedleModel {
  return createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 0 });
}

function deep(mm: number, model = newNeedle()): NeedleModel {
  return advance(model, mm, air).state;
}

describe('fulcrum at the skin entry point (F4.2)', () => {
  it('the shaft passes within 0.01 mm of the entry point for several hub angles under 10 mm deep', () => {
    for (const depth of [0, 2, 5, 9.5]) {
      for (const [pitch, yaw] of [[0, 0], [10, 0], [0, -15], [20, 25], [-30, 40]]) {
        const state = toNeedleState(setHubAngles(deep(depth), { pitch, yaw }));
        expect(distanceToPolyline(state.shaft, ENTRY), `depth ${depth}, ${pitch}/${yaw}`).toBeLessThan(0.01);
      }
    }
  });

  it('a small hub change moves the tip to the opposite side, by inserted ÷ outside length (within 5%)', () => {
    const depth = 8;
    const before = toNeedleState(deep(depth));
    for (const angles of [{ pitch: 2, yaw: 0 }, { pitch: 0, yaw: -2 }, { pitch: 1.5, yaw: 1.5 }]) {
      const after = toNeedleState(setHubAngles(deep(depth), angles));
      const hubMove = sub(after.shaft[0], before.shaft[0]);
      const tipMove = sub(after.tip, before.tip);
      expect(dot(hubMove, tipMove)).toBeLessThan(0); // opposite sides
      const outside = needleSpec(NEEDLE).lengthMm - depth;
      const ratio = len(tipMove) / len(hubMove);
      expect(Math.abs(ratio / (depth / outside) - 1)).toBeLessThan(0.05);
    }
  });

  it('pitch tilts the needle toward 12 o\'clock (the head) and yaw toward 3 o\'clock (the patient\'s right)', () => {
    const pitched = toNeedleState(setHubAngles(deep(8), { pitch: 5, yaw: 0 }));
    expect(pitched.tip.z).toBeGreaterThan(0); // hub → fulcrum direction turned toward +z
    const yawed = toNeedleState(setHubAngles(deep(8), { pitch: 0, yaw: 5 }));
    expect(yawed.tip.x).toBeLessThan(0); // patient's right = −x
  });
});

describe('shaft length and insertion limits (F4.9)', () => {
  it('keeps the catalogue length within 1% after advances, withdrawals and hub changes', () => {
    const L = needleSpec(NEEDLE).lengthMm;
    let m = newNeedle();
    const steps: ((x: NeedleModel) => NeedleModel)[] = [
      (x) => advance(x, 6, air).state,
      (x) => setHubAngles(x, { pitch: 8, yaw: -4 }),
      (x) => advance(x, 3.3, air).state,
      (x) => withdraw(x, 2.1),
      (x) => setHubAngles(x, { pitch: -5, yaw: 12 }),
      (x) => advance(x, 40, air).state,
      (x) => withdraw(x, 17.7),
    ];
    for (const step of steps) {
      m = step(m);
      const state = toNeedleState(m);
      expect(Math.abs(shaftLength(state.shaft) / L - 1)).toBeLessThan(0.01);
    }
  });

  it('cannot go past its own length; cannot withdraw below depth 0', () => {
    const L = needleSpec(NEEDLE).lengthMm;
    const full = toNeedleState(advance(newNeedle(), L + 10, air).state);
    expect(full.insertedDepth).toBeCloseTo(L, 6);
    expect(len(sub(full.shaft[0], ENTRY))).toBeLessThan(0.01); // hub at the skin

    const out = toNeedleState(withdraw(deep(5), 12));
    expect(out.insertedDepth).toBe(0);
    expect(len(sub(out.tip, ENTRY))).toBeLessThan(0.01);
  });

  it('advances in the model\'s small steps: the depth after advancing matches the request', () => {
    const state = toNeedleState(deep(7.3));
    expect(state.insertedDepth).toBeCloseTo(7.3, 6);
    expect(len(sub(state.tip, ENTRY))).toBeCloseTo(7.3, 6);
  });
});

describe('toNeedleState', () => {
  it('reports the tip, depth and the inputs', () => {
    const model = setHubAngles(
      advance(createNeedle({ needleId: NEEDLE, entryPoint: ENTRY, direction: DOWN, preBend: 10 }), 6, air).state,
      { pitch: 3, yaw: -2 },
    );
    const state = toNeedleState(model);
    expect(state.tip).toEqual(state.shaft[state.shaft.length - 1]);
    expect(state.insertedDepth).toBeCloseTo(6, 6);
    expect(state.needleId).toBe(NEEDLE);
    expect(state.preBend).toBe(10);
    expect(state.entryPoint).toEqual(ENTRY);
    expect(state.hubAngles).toEqual({ pitch: 3, yaw: -2 });
    expect(state.bevelAngle).toBe(0);
  });
});

describe('pure functions', () => {
  it('never change their input', () => {
    const input = { needleId: NEEDLE, entryPoint: { ...ENTRY }, direction: { ...DOWN }, preBend: 5 };
    const inputCopy = structuredClone(input);
    let m = createNeedle(input);
    expect(input).toEqual(inputCopy);

    const calls: ((x: NeedleModel) => unknown)[] = [
      (x) => advance(x, 5, air),
      (x) => setHubAngles(x, { pitch: 4, yaw: 4 }),
      (x) => withdraw(x, 2),
      (x) => toNeedleState(x),
    ];
    m = advance(m, 3, air).state;
    for (const call of calls) {
      const copy = structuredClone(m);
      const result = call(m);
      expect(m).toEqual(copy);
      if (call !== calls[3]) m = (result as { state?: NeedleModel }).state ?? (result as NeedleModel);
    }
    // A NeedleState handed out is a copy: changing it does not change the model.
    const state = toNeedleState(m);
    state.tip.x = 999;
    state.shaft[0].y = 999;
    expect(toNeedleState(m).tip.x).not.toBe(999);
    expect(toNeedleState(m).shaft[0].y).not.toBe(999);
  });
});
