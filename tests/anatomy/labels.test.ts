import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBone, LEVEL_CODES, TISSUE } from '../../src/core/labels';
import { labelsFromMasks, loadLabelMap, validateLabelMap, type Mask } from '../../tools/anatomy/labels';

const rawMap = JSON.parse(readFileSync(new URL('../../tools/anatomy/label-map.json', import.meta.url), 'utf8'));

// Fixture: a 6×1×1 row of voxels (the CT itself is not needed to label from masks).
const size = { x: 6, y: 1, z: 1 };
const mask = (name: string, inside: number[]): Mask => ({
  name,
  size,
  data: Uint8Array.from({ length: 6 }, (_, n) => (inside.includes(n) ? 1 : 0)),
});

describe('label-map.json', () => {
  it('is valid: tissue keys from TISSUE, bone entries with a level, not reviewed by the owner', () => {
    expect(validateLabelMap(rawMap)).toEqual([]);
    expect(rawMap.reviewedByOwner).toBe(false);
    expect(rawMap.note).toMatch(/F1\.7/);
    for (const e of rawMap.entries) {
      expect(Object.keys(TISSUE)).toContain(e.tissue);
      if (isBone(TISSUE[e.tissue as keyof typeof TISSUE])) expect(LEVEL_CODES).toContain(e.level);
    }
    expect(loadLabelMap().entries.length).toBe(rawMap.entries.length);
  });

  it('holds the draft mapping from the story', () => {
    const tissueOf = (m: string) => rawMap.entries.find((e: { mask: string }) => e.mask === m)?.tissue;
    expect(tissueOf('vertebrae_L4')).toBe('cancellousBone');
    expect(tissueOf('sacrum')).toBe('cancellousBone');
    expect(tissueOf('hip_left')).toBe('cancellousBone');
    expect(tissueOf('spinal_cord')).toBe('thecalSac');
    expect(tissueOf('aorta')).toBe('artery');
    expect(tissueOf('iliac_artery_left')).toBe('artery');
    expect(tissueOf('inferior_vena_cava')).toBe('vein');
    expect(tissueOf('autochthon_left')).toBe('muscle');
  });

  it('flags a bad table', () => {
    expect(validateLabelMap({ reviewedByOwner: false, entries: [{ mask: 'x', tissue: 'bonez' }] })[0]).toMatch(/TISSUE/);
    expect(validateLabelMap({ reviewedByOwner: false, entries: [{ mask: 'x', tissue: 'cancellousBone' }] })[0]).toMatch(
      /level/,
    );
    expect(validateLabelMap({ reviewedByOwner: false, entries: [{ mask: 'x', tissue: 'cancellousBone', level: 'L9' }] })).toHaveLength(1);
  });
});

describe('labelsFromMasks', () => {
  const map = loadLabelMap();

  it('gives each masked voxel its mapped label, and leaves unmasked voxels as air', () => {
    const { labels, ignored } = labelsFromMasks(
      size,
      [
        mask('vertebrae_L4', [0]),
        mask('vertebrae_L5', [1]),
        mask('spinal_cord', [2]),
        mask('aorta', [3]),
        mask('inferior_vena_cava', [4]),
      ],
      map,
    );
    expect(Array.from(labels)).toEqual([
      TISSUE.cancellousBone,
      TISSUE.cancellousBone,
      TISSUE.thecalSac,
      TISSUE.artery,
      TISSUE.vein,
      TISSUE.air,
    ]);
    expect(ignored).toEqual([]);
  });

  it('makes overlaps bone when a bone mask is involved, else the first in the table wins', () => {
    // aorta is listed before inferior_vena_cava; vertebrae come first but bone wins regardless of order.
    const { labels } = labelsFromMasks(
      size,
      [
        mask('inferior_vena_cava', [0, 1]),
        mask('aorta', [1, 2]),
        mask('spinal_cord', [3]),
        mask('vertebrae_L4', [0, 3]),
      ],
      map,
    );
    expect(labels[0]).toBe(TISSUE.cancellousBone);
    expect(labels[1]).toBe(TISSUE.artery);
    expect(labels[2]).toBe(TISSUE.artery);
    expect(labels[3]).toBe(TISSUE.cancellousBone);
  });

  it('lets bone win even if a non-bone entry were listed before it', () => {
    const custom = {
      ...map,
      entries: [
        { mask: 'aorta', tissue: 'artery' as const },
        { mask: 'vertebrae_L4', tissue: 'cancellousBone' as const, level: 'L4' as const },
      ],
    };
    const { labels } = labelsFromMasks(size, [mask('aorta', [0]), mask('vertebrae_L4', [0])], custom);
    expect(labels[0]).toBe(TISSUE.cancellousBone);
  });

  it('ignores and reports a mask whose name is not in the table', () => {
    const without = labelsFromMasks(size, [mask('aorta', [3])], map);
    const withUnknown = labelsFromMasks(size, [mask('aorta', [3]), mask('mystery_organ', [0, 1, 2, 3])], map);
    expect(Array.from(withUnknown.labels)).toEqual(Array.from(without.labels));
    expect(withUnknown.ignored).toEqual(['mystery_organ']);
  });

  it('rejects a mask whose size differs from the CT’s, with a clear error', () => {
    const wrong: Mask = { name: 'aorta', size: { x: 5, y: 1, z: 1 }, data: new Uint8Array(5) };
    expect(() => labelsFromMasks(size, [wrong], map)).toThrow(/"aorta" is 5×1×1.*CT is 6×1×1/);
  });
});
