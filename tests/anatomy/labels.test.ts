import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBone, LEVEL_CODES, TISSUE } from '../../src/core/labels';
import {
  labelsFromMasks,
  loadLabelMap,
  refineLabelsByHu,
  validateLabelMap,
  validateThresholds,
  type Mask,
} from '../../tools/anatomy/labels';

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

describe('refineLabelsByHu (CT-number thresholds)', () => {
  const map = loadLabelMap();
  const t = map.thresholds!;

  it('makes bone voxels at or above the threshold cortical and below it cancellous', () => {
    const c = t.bone.corticalFromHu;
    const { labels } = labelsFromMasks(size, [mask('vertebrae_L4', [0, 1, 2]), mask('sacrum', [3])], map);
    const out = refineLabelsByHu(labels, [c, c + 500, c - 1, c - 400, 0, 0], t);
    expect(Array.from(out.slice(0, 4))).toEqual([
      TISSUE.corticalBone,
      TISSUE.corticalBone,
      TISSUE.cancellousBone,
      TISSUE.cancellousBone,
    ]);
  });

  it('labels unmasked voxels air, skin/fat or muscle by their CT number', () => {
    const u = t.unmasked;
    const labels = new Uint8Array(6);
    const hu = [-3000, u.skinFatFromHu - 1, u.skinFatFromHu, u.muscleFromHu - 1, u.muscleFromHu, 1500];
    expect(Array.from(refineLabelsByHu(labels, hu, t))).toEqual([
      TISSUE.air,
      TISSUE.air,
      TISSUE.skinFat,
      TISSUE.skinFat,
      TISSUE.muscle,
      TISSUE.muscle,
    ]);
  });

  it('leaves voxels from non-bone masks (canal, artery, vein, muscle) alone whatever their CT number', () => {
    const { labels } = labelsFromMasks(
      size,
      [mask('spinal_cord', [0]), mask('aorta', [1]), mask('inferior_vena_cava', [2]), mask('autochthon_left', [3])],
      map,
    );
    for (const hu of [-1000, -100, 50, 3000]) {
      const out = refineLabelsByHu(labels, [hu, hu, hu, hu, hu, hu], t);
      expect(Array.from(out.slice(0, 4))).toEqual([TISSUE.thecalSac, TISSUE.artery, TISSUE.vein, TISSUE.muscle]);
    }
  });

  it('keeps the thresholds in label-map.json finite, rising, and not reviewed by the owner', () => {
    expect(validateThresholds(rawMap)).toEqual([]);
    const u = rawMap.thresholds.unmasked;
    for (const v of [u.airFromHu, u.skinFatFromHu, u.muscleFromHu, rawMap.thresholds.bone.corticalFromHu]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(u.airFromHu).toBeLessThan(u.skinFatFromHu);
    expect(u.skinFatFromHu).toBeLessThan(u.muscleFromHu);
    expect(rawMap.reviewedByOwner).toBe(false);
  });

  it('flags thresholds that are missing, not finite or not rising', () => {
    expect(validateThresholds({})).toHaveLength(1);
    const bad = (unmasked: object, bone: object = { corticalFromHu: 600 }) =>
      validateThresholds({ thresholds: { bone, unmasked } });
    expect(bad({ airFromHu: -1000, skinFatFromHu: -250, muscleFromHu: Number.NaN })[0]).toMatch(/finite/);
    expect(bad({ airFromHu: -1000, skinFatFromHu: 0, muscleFromHu: -20 })[0]).toMatch(/rise/);
    expect(bad({ airFromHu: -1000, skinFatFromHu: -250, muscleFromHu: -20 }, {})[0]).toMatch(/corticalFromHu/);
  });

  it('rejects a CT whose voxel count differs from the labels', () => {
    expect(() => refineLabelsByHu(new Uint8Array(6), [0, 0], t)).toThrow(/2 voxels/);
  });
});
