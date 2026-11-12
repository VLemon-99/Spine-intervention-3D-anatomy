import { describe, expect, it } from 'vitest';
import { isBone, LEVEL_IDS, TISSUE } from '../../src/core/labels';
import { createPhantomLandmarks } from '../../src/core/phantom';
import { loadSoftTissueParams, modelSoftTissue, modelThecalSac } from '../../tools/anatomy/softTissue';
import { expectMidlineOrder } from './softTissueChecks';
import { createStrippedPhantom } from './strippedPhantom';

const N = 95;
const pos = (v: number) => ({ x: (v % N) - 47, y: (Math.floor(v / N) % N) - 47, z: Math.floor(v / (N * N)) - 47 });

describe('soft-tissue modeller: thecal sac when the scan has none', () => {
  const noSac = createStrippedPhantom({ removeSac: true });
  const params = loadSoftTissueParams();
  const sacOnly = noSac.labels.slice();
  modelThecalSac(noSac, sacOnly, params);

  it('starts from a volume with no thecal sac or cord', () => {
    expect(noSac.labels.includes(TISSUE.thecalSac)).toBe(false);
    expect(noSac.labels.includes(TISSUE.spinalCord)).toBe(false);
  });

  it('models a sac inside the canal at every vertebral level’s height, none in bone or outside the canal', () => {
    const sacZ = new Set<number>();
    for (let v = 0; v < sacOnly.length; v++) {
      if (sacOnly[v] !== TISSUE.thecalSac) continue;
      expect(isBone(noSac.labels[v])).toBe(false);
      const p = pos(v);
      // The phantom's canal: |x| ≤ 9, −2 ≤ y ≤ 15.
      expect(Math.abs(p.x) <= 9 && p.y >= -2 && p.y <= 15, `${p.x},${p.y},${p.z}`).toBe(true);
      sacZ.add(p.z);
    }
    for (const level of [LEVEL_IDS.L4, LEVEL_IDS.L5]) {
      const zs = new Set<number>();
      noSac.levels!.forEach((l, v) => {
        if (l === level) zs.add(pos(v).z);
      });
      for (const z of zs) expect(sacZ.has(z), `level ${level} z ${z}`).toBe(true);
    }
  });

  it('restores the midline order after the full modelling run', () => {
    expectMidlineOrder(modelSoftTissue(noSac, createPhantomLandmarks()));
  });

  it('leaves a volume that already has thecal sac voxels unchanged', () => {
    const withSac = createStrippedPhantom();
    const labels = withSac.labels.slice();
    modelThecalSac(withSac, labels, params);
    expect(Array.from(labels)).toEqual(Array.from(withSac.labels));
  });

  it('changes no bone voxel or intensity, and running twice equals running once', () => {
    const once = modelSoftTissue(noSac, createPhantomLandmarks());
    for (let v = 0; v < noSac.labels.length; v++) {
      if (isBone(noSac.labels[v]) || isBone(once.labels[v])) expect(once.labels[v]).toBe(noSac.labels[v]);
    }
    expect(once.intensity).toEqual(noSac.intensity);
    const twice = modelSoftTissue(once, createPhantomLandmarks());
    expect(Array.from(twice.labels)).toEqual(Array.from(once.labels));
  });
});
