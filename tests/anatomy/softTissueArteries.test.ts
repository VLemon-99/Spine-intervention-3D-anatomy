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

describe('soft-tissue modeller: lumbar segmental arteries', () => {
  const stripped = createStrippedPhantom();
  const landmarks = createPhantomLandmarks();
  const modelled = modelSoftTissue(stripped, landmarks);
  const arteries = [...modelled.labels.keys()].filter((v) => modelled.labels[v] === TISSUE.artery).map(pos);

  it('the stripped phantom has no artery to begin with', () => {
    expect(stripped.labels.includes(TISSUE.artery)).toBe(false);
  });

  it('puts modelled artery voxels within 4 mm of the L4 foramen centre, left and right', () => {
    const l4 = landmarks.levels.find((l) => l.level === 'L4')!;
    for (const side of ['left', 'right'] as const) {
      const f = l4.foramenCentre![side]!;
      expect(Math.min(...arteries.map((a) => dist(a, f))), side).toBeLessThanOrEqual(4);
      expect(arteries.some((a) => Math.sign(a.x) === (side === 'left' ? 1 : -1))).toBe(true);
    }
  });

  it('changes no bone and no nerve-root voxel', () => {
    const rootsOnly = modelSoftTissue(stripped, { ...landmarks, levels: landmarks.levels.map((l) => ({ ...l, level: 'T12' as const })) });
    for (let v = 0; v < stripped.labels.length; v++) {
      if (isBone(stripped.labels[v]) || isBone(modelled.labels[v])) expect(modelled.labels[v]).toBe(stripped.labels[v]);
      if (rootsOnly.labels[v] === TISSUE.nerveRoot) expect(modelled.labels[v]).toBe(TISSUE.nerveRoot);
    }
  });

  it('gives levels outside L1–L5 no modelled artery', () => {
    const thoracic: Landmarks = {
      ...landmarks,
      levels: landmarks.levels.map((l) => ({ ...l, level: l.level === 'L4' ? ('T12' as const) : ('T11' as const) })),
    };
    expect(modelSoftTissue(stripped, thoracic).labels.includes(TISSUE.artery)).toBe(false);
  });

  it('keeps the checks of the earlier modelling steps after all steps run together', () => {
    // F1-S13 / F1-S26: midline order, on the stripped phantom and with the sac removed too.
    expectMidlineOrder(modelled);
    const noSac = createStrippedPhantom({ removeSac: true });
    const all = modelSoftTissue(noSac, landmarks);
    expectMidlineOrder(all);
    expect(all.labels.includes(TISSUE.thecalSac)).toBe(true);
    // F1-S14: a nerve root within 2 mm of each foramen centre.
    const roots = [...modelled.labels.keys()].filter((v) => modelled.labels[v] === TISSUE.nerveRoot).map(pos);
    for (const side of ['left', 'right'] as const) {
      const f = landmarks.levels[0].foramenCentre![side]!;
      expect(Math.min(...roots.map((r) => dist(r, f)))).toBeLessThanOrEqual(2);
    }
    // F1-S15: joint space on both sides at the L4–L5 articular pillars.
    const joints = [...modelled.labels.keys()].filter((v) => modelled.labels[v] === TISSUE.jointSpace).map(pos);
    for (const side of [1, -1]) {
      expect(joints.some((p) => Math.sign(p.x) === side && Math.abs(p.x) >= 12 && Math.abs(p.x) <= 18 && p.z === 0)).toBe(true);
    }
    // No bone changed, intensity untouched, and two runs equal one.
    for (let v = 0; v < stripped.labels.length; v++) {
      if (isBone(stripped.labels[v])) expect(modelled.labels[v]).toBe(stripped.labels[v]);
    }
    expect(modelled.intensity).toEqual(stripped.intensity);
    expect(Array.from(modelSoftTissue(modelled, landmarks).labels)).toEqual(Array.from(modelled.labels));
  });
});
