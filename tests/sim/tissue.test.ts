import { describe, expect, it } from 'vitest';
import { labelAt, tipTissue } from '../../src/sim/tissue';
import { tissues } from '../../src/sim/data';
import { createPhantom, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import { TISSUE, TISSUE_LABELS } from '../../src/core/labels';
import type { Volume } from '../../src/core/types';
import { needleAt } from './needleStates';

const phantom = createPhantom();

describe('tissue at the needle tip (F6.1)', () => {
  it.each([
    ['body centre', PHANTOM_TEST_POINTS.blockCentres.upper, 'cancellousBone'],
    ['lower body centre', PHANTOM_TEST_POINTS.blockCentres.lower, 'cancellousBone'],
    ['(0, 6, 0)', { x: 0, y: 6, z: 0 }, 'spinalCord'],
    ['(0, 19, 0)', { x: 0, y: 19, z: 0 }, 'ligamentumFlavum'],
    ['(0, 14, 0)', { x: 0, y: 14, z: 0 }, 'epiduralSpace'],
  ] as const)('a tip at the %s is in %s', (_where, point, key) => {
    const result = tipTissue(needleAt(point), phantom);
    expect(result.key).toBe(key);
    const label = TISSUE_LABELS.find((l) => l.key === key)!;
    expect(result.id).toBe(label.id);
    expect(result.name).toBe(label.name);
  });

  it('returns the resistance from tissues.json for that tissue', () => {
    for (const point of [
      PHANTOM_TEST_POINTS.blockCentres.upper,
      { x: 0, y: 19, z: 0 },
      { x: 0, y: 14, z: 0 },
      { x: 0, y: 6, z: 0 },
    ]) {
      const result = tipTissue(needleAt(point), phantom);
      expect(result.resistance).toBe(tissues.resistance[result.key]);
    }
    expect(tissues.resistance.ligamentumFlavum).not.toBe(tissues.resistance.epiduralSpace);
  });

  it('a tip outside the grid is air', () => {
    const far = needleAt({ x: 500, y: 0, z: 0 });
    const result = tipTissue(far, phantom);
    expect(result.key).toBe('air');
    expect(result.id).toBe(TISSUE.air);
    expect(result.resistance).toBe(tissues.resistance.air);
    expect(labelAt(phantom, { x: 0, y: 0, z: -1000 })).toBe(TISSUE.air);
  });

  it('labelAt takes the nearest voxel', () => {
    // 0.4 mm off the ligamentum flavum point still rounds to the same voxel.
    expect(labelAt(phantom, { x: 0.4, y: 19.4, z: -0.4 })).toBe(TISSUE.ligamentumFlavum);
  });

  it('rejects a volume that is not in the standard layout', () => {
    const turned: Volume = {
      ...phantom,
      orientation: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
    };
    expect(() => labelAt(turned, { x: 0, y: 0, z: 0 })).toThrow(/standard layout/);
    expect(() => tipTissue(needleAt({ x: 0, y: 14, z: 0 }), turned)).toThrow(/standard layout/);
  });
});
