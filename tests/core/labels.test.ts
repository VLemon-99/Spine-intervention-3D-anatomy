import { describe, expect, it } from 'vitest';
import {
  LEVEL_CODES,
  LEVEL_IDS,
  NO_LEVEL,
  TISSUE,
  TISSUE_LABELS,
  isBone,
  levelCodeFromId,
} from '../../src/core/labels';

const REQUIRED_TISSUES = [
  'air',
  'skinFat',
  'muscle',
  'corticalBone',
  'cancellousBone',
  'disc',
  'ligamentumFlavum',
  'epiduralSpace',
  'thecalSac',
  'spinalCord',
  'nerveRoot',
  'artery',
  'vein',
  'jointSpace',
] as const;

describe('tissue labels', () => {
  it('lists every tissue label named in F0.4', () => {
    const keys = TISSUE_LABELS.map((t) => t.key);
    for (const key of REQUIRED_TISSUES) {
      expect(keys, `missing tissue ${key}`).toContain(key);
      expect(TISSUE[key]).toBe(TISSUE_LABELS.find((t) => t.key === key)?.id);
    }
  });

  it('gives each label a unique id from 0 to 255, with air = 0', () => {
    const ids = TISSUE_LABELS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(255);
    }
    expect(TISSUE.air).toBe(0);
  });

  it('gives each label a display name', () => {
    for (const t of TISSUE_LABELS) expect(t.name.length).toBeGreaterThan(0);
  });

  it('isBone() is true for cortical and cancellous bone only', () => {
    for (const t of TISSUE_LABELS) {
      const expected = t.key === 'corticalBone' || t.key === 'cancellousBone';
      expect(isBone(t.id), t.key).toBe(expected);
    }
    // Unknown ids are not bone either.
    expect(isBone(254)).toBe(false);
  });
});

describe('vertebral levels', () => {
  const expectedCodes = [
    ...Array.from({ length: 7 }, (_, i) => `C${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`),
    'sacrum',
    'ilium',
  ];

  it('lists C1–C7, T1–T12, L1–L5, sacrum and ilium', () => {
    expect([...LEVEL_CODES]).toEqual(expectedCodes);
  });

  it('gives each level a unique id from 1 to 255; 0 means no level', () => {
    const ids = LEVEL_CODES.map((code) => LEVEL_IDS[code]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(255);
    }
    expect(NO_LEVEL).toBe(0);
  });

  it('maps ids back to codes, and 0 to no level', () => {
    for (const code of LEVEL_CODES) expect(levelCodeFromId(LEVEL_IDS[code])).toBe(code);
    expect(levelCodeFromId(NO_LEVEL)).toBeUndefined();
  });
});
