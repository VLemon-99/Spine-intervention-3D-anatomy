import { describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import { createProjection } from '../../src/core/geometry';
import type { Vec3 } from '../../src/core/types';
import { catalogue } from '../../src/needle/data';
import { skinEntry } from '../../src/needle/entry';
import { createNeedleSession, type NeedleSession } from '../../src/needle/session';

const phantom = createPhantom();
const AP = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const ray = createProjection(AP).unproject({ x: 256, y: 256 });
const entry = skinEntry(phantom, ray) as Vec3;
const CURVED = catalogue.needles.find((n) => n.tipType === 'curved')!.id;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const angleDeg = (a: Vec3, b: Vec3) =>
  (Math.acos(
    Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))),
  ) *
    180) /
  Math.PI;

function fresh(): NeedleSession {
  return createNeedleSession(phantom);
}

describe('needle session: choosing before insertion (F5.1)', () => {
  it('changes needle and pre-bend; rejects a bad pre-bend', () => {
    const s = fresh();
    expect(s.chooseNeedle('quincke-25g-127')).toBe('ok');
    expect(s.needleId).toBe('quincke-25g-127');
    expect(s.choosePreBend(15)).toBe('ok');
    expect(s.preBend).toBe(15);
    for (const bad of [7, -5, 35, Number.NaN]) {
      expect(s.choosePreBend(bad)).toBe('rejected');
      expect(s.preBend).toBe(15);
    }
    expect(s.chooseNeedle('no-such-needle')).toBe('rejected');
    expect(s.needleId).toBe('quincke-25g-127');
  });

  it('ignores the pre-bend for the curved-tip cannula (its curve is built in)', () => {
    const s = fresh();
    s.chooseNeedle(CURVED);
    expect(s.choosePreBend(20)).toBe('ignored');
    s.markEntry(entry, ray.direction);
    expect(s.toNeedleState()!.preBend).toBe(catalogue.needles.find((n) => n.id === CURVED)!.tipCurveDeg);
  });
});

describe('needle session: lock while inserted (F5.1)', () => {
  it('refuses changes after advancing and accepts them again after withdrawFully', () => {
    const s = fresh();
    s.chooseNeedle('quincke-22g-89');
    expect(s.markEntry(entry, ray.direction)).toBe('ok');
    expect(s.advance(1)).toBe('ok');
    expect(s.locked).toBe(true);
    const before = s.toNeedleState();
    expect(s.chooseNeedle('tuohy-20g-89')).toBe('locked');
    expect(s.choosePreBend(10)).toBe('locked');
    expect(s.markEntry({ x: 5, y: 40, z: 0 }, ray.direction)).toBe('locked');
    expect(s.needleId).toBe('quincke-22g-89');
    expect(s.preBend).toBe(0);
    expect(s.toNeedleState()).toEqual(before);

    s.withdrawFully();
    expect(s.locked).toBe(false);
    expect(s.toNeedleState()).toBeNull();
    expect(s.chooseNeedle('tuohy-20g-89')).toBe('ok');
    expect(s.choosePreBend(10)).toBe('ok');
    expect(s.markEntry(entry, ray.direction)).toBe('ok');
  });
});

describe('needle session: down the beam (F5.3)', () => {
  it('points against the beam and advances into the body from the back', () => {
    const s = fresh();
    s.markEntry(entry, ray.direction);
    const st = s.toNeedleState()!;
    const hub = st.shaft[0];
    expect(Math.abs(angleDeg(sub(st.entryPoint, hub), ray.direction) - 180)).toBeLessThan(0.1);
    expect(st.tip).toEqual(st.entryPoint);
    s.advance(5);
    const tip = s.toNeedleState()!.tip;
    expect(tip.y).toBeLessThan(entry.y - 4.9);
  });
});

describe('needle session: hub limits (F5.4)', () => {
  it('clamps setHubAngles and nudgeHub to ±45°', () => {
    const s = fresh();
    s.markEntry(entry, ray.direction);
    s.setHubAngles(60, -70);
    expect(s.toNeedleState()!.hubAngles).toEqual({ pitch: 45, yaw: -45 });
    s.setHubAngles(0, 0);
    for (let i = 0; i < 100; i++) s.nudgeHub(1, -1);
    expect(s.toNeedleState()!.hubAngles).toEqual({ pitch: 45, yaw: -45 });
    for (let i = 0; i < 200; i++) s.nudgeHub(-1, 1);
    expect(s.toNeedleState()!.hubAngles).toEqual({ pitch: -45, yaw: 45 });
  });

  it('does nothing to the hub before an entry is marked', () => {
    const s = fresh();
    expect(s.nudgeHub(1, 1)).toBe('noNeedle');
    expect(s.advance(1)).toBe('noNeedle');
    expect(s.toNeedleState()).toBeNull();
  });
});

describe('needle session: determinism', () => {
  it('gives an identical NeedleState for the same calls', () => {
    const run = () => {
      const s = fresh();
      s.chooseNeedle('quincke-25g-89');
      s.choosePreBend(10);
      s.markEntry(entry, ray.direction);
      s.setHubAngles(5, -3);
      s.advance(20);
      s.rotateBevel(90);
      s.nudgeHub(1, 2);
      s.advance(10.4);
      s.withdraw(3);
      return s.toNeedleState();
    };
    expect(run()).toEqual(run());
  });
});

describe('needle session: marking from an image pixel (F5.2)', () => {
  it('does nothing before the first image', () => {
    const s = fresh();
    expect(s.markEntryAtPixel({ x: 256, y: 256 })).toBe('rejected');
    expect(s.toNeedleState()).toBeNull();
  });

  it('marks the skin entry under the pixel, pointing against the ray', () => {
    const s = fresh();
    s.lastImagePose = AP;
    expect(s.markEntryAtPixel({ x: 256, y: 256 })).toBe('ok');
    expect(s.toNeedleState()!.entryPoint).toEqual(entry);
    s.advance(1);
    expect(s.markEntryAtPixel({ x: 250, y: 250 })).toBe('locked');
  });
});
