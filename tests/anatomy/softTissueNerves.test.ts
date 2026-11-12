import { describe, expect, it } from 'vitest';
import { isBone, TISSUE } from '../../src/core/labels';
import { createPhantomLandmarks } from '../../src/core/phantom';
import type { Landmarks, Vec3 } from '../../src/core/types';
import { modelSoftTissue } from '../../tools/anatomy/softTissue';
import { expectMidlineOrder } from './softTissueChecks';
import { createStrippedPhantom } from './strippedPhantom';

const N = 95;
const pos = (v: number): Vec3 => ({ x: (v % N) - 47, y: (Math.floor(v / N) % N) - 47, z: Math.floor(v / (N * N)) - 47 });
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('soft-tissue modeller: exiting nerve roots', () => {
  const stripped = createStrippedPhantom();
  const landmarks = createPhantomLandmarks();
  const modelled = modelSoftTissue(stripped, landmarks);
  const roots: Vec3[] = [];
  const sac: Vec3[] = [];
  modelled.labels.forEach((l, v) => {
    if (l === TISSUE.nerveRoot) roots.push(pos(v));
    if (l === TISSUE.thecalSac) sac.push(pos(v));
  });

  it('the stripped phantom has no nerve roots to begin with', () => {
    expect(stripped.labels.includes(TISSUE.nerveRoot)).toBe(false);
  });

  it('puts nerve-root voxels within 2 mm of every foramen centre, left and right', () => {
    let foramina = 0;
    for (const level of landmarks.levels) {
      for (const side of ['left', 'right'] as const) {
        const f = level.foramenCentre?.[side];
        if (!f) continue;
        foramina++;
        expect(Math.min(...roots.map((r) => dist(r, f))), `${level.level} ${side}`).toBeLessThanOrEqual(2);
      }
    }
    expect(foramina).toBe(2);
  });

  it('makes each nerve root touch the thecal sac at its inner end', () => {
    for (const side of [1, -1]) {
      const own = roots.filter((r) => Math.sign(r.x) === side);
      expect(own.length).toBeGreaterThan(0);
      const inner = own.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
      expect(Math.min(...sac.map((s) => dist(s, inner)))).toBeLessThanOrEqual(1.5);
    }
  });

  it('changes no bone voxel, and the midline order still holds', () => {
    for (let v = 0; v < stripped.labels.length; v++) {
      if (isBone(stripped.labels[v]) || isBone(modelled.labels[v])) expect(modelled.labels[v]).toBe(stripped.labels[v]);
    }
    expectMidlineOrder(modelled);
  });

  it('gives a level without a foramen centre no nerve root, without error', () => {
    // The phantom's L5 has no foramen: no root lies at L5's pedicle height (z −22 … −12).
    expect(roots.some((r) => r.z <= -12)).toBe(false);
    const onlyLeft: Landmarks = {
      ...landmarks,
      levels: landmarks.levels.map((l) => (l.foramenCentre ? { ...l, foramenCentre: { left: l.foramenCentre.left } } : l)),
    };
    const result = modelSoftTissue(stripped, onlyLeft);
    const rightRoots = Array.from(result.labels).filter((l, v) => l === TISSUE.nerveRoot && pos(v).x < 0);
    expect(rightRoots).toHaveLength(0);
    const none: Landmarks = { ...landmarks, levels: landmarks.levels.map((l) => ({ ...l, foramenCentre: undefined })) };
    expect(modelSoftTissue(stripped, none).labels.includes(TISSUE.nerveRoot)).toBe(false);
  });

  it('gives the same result when run twice', () => {
    expect(Array.from(modelSoftTissue(modelled, landmarks).labels)).toEqual(Array.from(modelled.labels));
  });
});
