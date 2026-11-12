import { describe, expect, it } from 'vitest';
import { TISSUE, TISSUE_LABELS } from '../../src/core/labels';
import { BONE_LABELS, LAYERS, layerObjectName } from '../../src/view3d/layers';

describe('3D view layers', () => {
  it('puts every tissue label except air in exactly one of bone and the four layers', () => {
    const groups = [BONE_LABELS, ...LAYERS.map((l) => l.labels)];
    for (const label of TISSUE_LABELS) {
      const count = groups.filter((g) => g.includes(label.id)).length;
      expect(count, `${label.key} is in ${count} groups`).toBe(label.id === TISSUE.air ? 0 : 1);
    }
  });

  it('has the four layers the owner chose, with nerves, vessels and thecal sac shown at start', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['nerves', 'vessels', 'thecal', 'soft']);
    expect(LAYERS.map((l) => layerObjectName(l.id))).toEqual([
      'layer-nerves',
      'layer-vessels',
      'layer-thecal',
      'layer-soft',
    ]);
    expect(Object.fromEntries(LAYERS.map((l) => [l.id, l.startVisible]))).toEqual({
      nerves: true,
      vessels: true,
      thecal: true,
      soft: false,
    });
    const soft = LAYERS.find((l) => l.id === 'soft')!;
    expect(soft.opacity).toBeLessThan(1);
  });
});
