import { describe, expect, it } from 'vitest';
import { TISSUE, type TissueKey } from '../../src/core/labels';
import type { Vec3, Volume } from '../../src/core/types';
import { advance, createNeedle, toNeedleState } from '../../src/needle/model';
import paramsJson from '../../src/needle/params.json';
import { uniformVolume } from './volumes';

const ENTRY: Vec3 = { x: 0, y: 40, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };

/** Tip distance from the straight line through the entry point along DOWN. */
function drift(needleId: string, volume: Volume, mm: number): number {
  const m = advance(createNeedle({ needleId, entryPoint: ENTRY, direction: DOWN, preBend: 0 }), mm, volume).state;
  const tip = toNeedleState(m).tip;
  return Math.hypot(tip.x - ENTRY.x, tip.z - ENTRY.z);
}

const muscle = uniformVolume(TISSUE.muscle, 201);

describe('drift ordering (F4.4, all else equal)', () => {
  it('a 25G Quincke drifts more than a 22G Quincke of the same length after 40 mm in muscle', () => {
    for (const lengthMm of [89, 127]) {
      const thin = drift(`quincke-25g-${lengthMm}`, muscle, 40);
      const thick = drift(`quincke-22g-${lengthMm}`, muscle, 40);
      expect(thin).toBeGreaterThan(thick);
      expect(thick).toBeGreaterThan(0);
    }
  });

  it('the same needle drifts more in the stiffer tissue than in the softer one', () => {
    // The stiffest and softest of muscle, skin/fat and ligamentum flavum, read from params.json.
    const candidates: TissueKey[] = ['muscle', 'skinFat', 'ligamentumFlavum'];
    const stiffness = paramsJson.tissueStiffness as Record<TissueKey, number>;
    const sorted = [...candidates].sort((a, b) => stiffness[a] - stiffness[b]);
    const softest = sorted[0];
    const stiffest = sorted[sorted.length - 1];
    expect(stiffness[stiffest]).toBeGreaterThan(stiffness[softest]);
    const stiff = uniformVolume(TISSUE[stiffest], 201);
    const soft = uniformVolume(TISSUE[softest], 201);
    for (const needleId of ['quincke-22g-89', 'quincke-25g-89']) {
      expect(drift(needleId, stiff, 40), needleId).toBeGreaterThan(drift(needleId, soft, 40));
    }
  });

  it('drift grows with depth: 20 mm < 30 mm < 40 mm', () => {
    for (const needleId of ['quincke-22g-89', 'quincke-25g-127']) {
      const d20 = drift(needleId, muscle, 20);
      const d30 = drift(needleId, muscle, 30);
      const d40 = drift(needleId, muscle, 40);
      expect(d20).toBeGreaterThan(0);
      expect(d30).toBeGreaterThan(d20);
      expect(d40).toBeGreaterThan(d30);
    }
  });
});
