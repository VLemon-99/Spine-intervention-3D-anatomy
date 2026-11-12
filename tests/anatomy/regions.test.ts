import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, TISSUE, type LevelCode } from '../../src/core/labels';
import { CROP_MARGIN_MM, REGIONS, cropToRegion, type CropInput } from '../../tools/anatomy/regions';

// Fixture builder: standard layout (i → left, j → back, k → head), 1 mm voxels unless given.
function makeVolume(size: { x: number; y: number; z: number }, spacing = { x: 1, y: 1, z: 1 }) {
  const count = size.x * size.y * size.z;
  const vol: CropInput = {
    size,
    spacing,
    origin: { x: -50, y: -40, z: 100 },
    intensity: new Uint8Array(count),
    labels: new Uint8Array(count),
    levels: new Uint8Array(count),
  };
  const at = (i: number, j: number, k: number) => i + size.x * (j + size.y * k);
  const fill = (lo: number[], hi: number[], label: number, level: LevelCode | null) => {
    for (let k = lo[2]; k <= hi[2]; k++)
      for (let j = lo[1]; j <= hi[1]; j++)
        for (let i = lo[0]; i <= hi[0]; i++) {
          const v = at(i, j, k);
          vol.labels[v] = label;
          vol.levels[v] = level ? LEVEL_IDS[level] : 0;
          vol.intensity[v] = (v * 37) % 251;
        }
  };
  return { vol, at, fill };
}

// Five stacked vertebrae along k (head-ward): T11, T12, L1, L2, L3, each 10 voxels tall with a 10-voxel gap.
function fiveVertebrae() {
  const f = makeVolume({ x: 40, y: 40, z: 100 });
  const stack: LevelCode[] = ['T11', 'T12', 'L1', 'L2', 'L3'];
  stack.forEach((level, n) => f.fill([15, 15, n * 20 + 5], [25, 25, n * 20 + 14], TISSUE.cancellousBone, level));
  return f;
}

describe('REGIONS', () => {
  it('has exactly the three regions and level ranges from the spec', () => {
    expect(Object.keys(REGIONS).sort()).toEqual(['cervical', 'lumbosacral', 'thoracic']);
    expect(REGIONS.cervical.levels).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'T1']);
    expect(REGIONS.thoracic.levels).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1']);
    expect(REGIONS.lumbosacral.levels).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'sacrum']);
    expect(REGIONS.lumbosacral.includesIlium).toBe(true);
    expect(REGIONS.cervical.includesIlium).toBe(false);
    expect(REGIONS.thoracic.includesIlium).toBe(false);
  });
});

describe('cropToRegion', () => {
  it('keeps all bone voxels of the region’s three vertebrae plus the margin, and drops the far parts of the other two', () => {
    const { vol } = fiveVertebrae();
    // Lumbosacral covers L1, L2, L3 here (k 45…94); T11 (k 5…14) and T12 (k 25…34) are outside it.
    const out = cropToRegion(vol, 'lumbosacral');
    expect(out.missingLevels).toEqual(['L4', 'L5', 'sacrum']);
    // Bone k range 45…94, margin 10 → 35…99 (99 = the volume's edge).
    expect(out.box.lo[2]).toBe(45 - CROP_MARGIN_MM);
    expect(out.box.hi[2]).toBe(99);
    expect(out.box.lo[0]).toBe(15 - CROP_MARGIN_MM);
    expect(out.box.hi[0]).toBe(25 + CROP_MARGIN_MM);
    const count = (levels: Uint8Array, level: LevelCode) => levels.filter((l) => l === LEVEL_IDS[level]).length;
    for (const level of ['L1', 'L2', 'L3'] as const) expect(count(out.levels, level)).toBe(count(vol.levels, level));
    expect(count(out.levels, 'T11')).toBe(0);
    expect(count(out.levels, 'T12')).toBeLessThan(count(vol.levels, 'T12'));
  });

  it('keeps every voxel at the same patient position (origin + index × spacing)', () => {
    const f = makeVolume({ x: 30, y: 30, z: 60 }, { x: 0.5, y: 1.5, z: 2 });
    f.fill([10, 10, 20], [15, 14, 30], TISSUE.cancellousBone, 'L4');
    const out = cropToRegion(f.vol, 'lumbosacral');
    const [i, j, k] = [12, 11, 25];
    const before = f.vol.intensity[f.at(i, j, k)];
    const [ci, cj, ck] = [i - out.box.lo[0], j - out.box.lo[1], k - out.box.lo[2]];
    expect(out.intensity[ci + out.size.x * (cj + out.size.y * ck)]).toBe(before);
    expect(out.origin.x + ci * out.spacing.x).toBeCloseTo(f.vol.origin.x + i * f.vol.spacing.x, 9);
    expect(out.origin.y + cj * out.spacing.y).toBeCloseTo(f.vol.origin.y + j * f.vol.spacing.y, 9);
    expect(out.origin.z + ck * out.spacing.z).toBeCloseTo(f.vol.origin.z + k * f.vol.spacing.z, 9);
    // The margin is in mm: 10 mm is 20 voxels at 0.5 mm, 7 at 1.5 mm, 5 at 2 mm.
    expect(out.box.lo).toEqual([0, 3, 15]);
  });

  it('for lumbosacral keeps the ilium next to the sacrum (SI joints) and the highest ilium voxel on each side (iliac crests)', () => {
    const f = makeVolume({ x: 120, y: 40, z: 160 });
    f.fill([55, 15, 100], [65, 25, 110], TISSUE.cancellousBone, 'L5');
    f.fill([50, 15, 60], [70, 25, 90], TISSUE.cancellousBone, 'sacrum');
    // Hip bones: SI joint parts next to the sacrum, wings rising up to crests, and a lower part far below.
    for (const [lo, hi] of [
      [10, 45],
      [75, 110],
    ]) {
      f.fill([lo, 15, 0], [hi, 25, 120], TISSUE.cancellousBone, 'ilium');
    }
    // Crest tips: the highest ilium voxel on each side.
    f.fill([5, 20, 135], [5, 20, 135], TISSUE.corticalBone, 'ilium');
    f.fill([114, 20, 137], [114, 20, 137], TISSUE.corticalBone, 'ilium');
    const out = cropToRegion(f.vol, 'lumbosacral', { marginMm: 2 });
    const inside = (i: number, j: number, k: number) =>
      i >= out.box.lo[0] && i <= out.box.hi[0] && j >= out.box.lo[1] && j <= out.box.hi[1] && k >= out.box.lo[2] && k <= out.box.hi[2];
    expect(inside(45, 20, 70)).toBe(true); // left ilium touching the sacrum
    expect(inside(75, 20, 70)).toBe(true); // right ilium touching the sacrum
    expect(inside(5, 20, 135)).toBe(true); // left crest
    expect(inside(114, 20, 137)).toBe(true); // right crest
    // The lower part of the hip bones (well below the sacrum and far from it) may be cut off.
    // Sacrum bottom k = 60, SI distance 30 mm → nothing below k = 30 is needed (minus the 2 mm margin).
    expect(out.box.lo[2]).toBe(28);
  });

  it('does not add ilium to regions without it', () => {
    const f = makeVolume({ x: 60, y: 30, z: 40 });
    f.fill([25, 10, 10], [35, 20, 20], TISSUE.cancellousBone, 'T12');
    f.fill([0, 10, 0], [5, 20, 39], TISSUE.cancellousBone, 'ilium');
    const out = cropToRegion(f.vol, 'thoracic', { marginMm: 2 });
    expect(out.box.lo[0]).toBe(23);
  });

  it('reaches the outermost skin voxel behind the region’s bones, and stops at the scan edge without error', () => {
    const f = makeVolume({ x: 30, y: 60, z: 40 });
    f.fill([10, 10, 10], [20, 20, 20], TISSUE.cancellousBone, 'L3');
    f.fill([0, 21, 0], [29, 44, 39], TISSUE.muscle, null);
    f.fill([0, 45, 0], [29, 49, 39], TISSUE.skinFat, null); // skin at the back: j = 49
    const out = cropToRegion(f.vol, 'lumbosacral');
    expect(out.box.hi[1]).toBeGreaterThanOrEqual(49);
    expect(out.labels.some((l) => l === TISSUE.skinFat)).toBe(true);

    // Scan cut before the skin: soft tissue runs to the last row (j = 59).
    const g = makeVolume({ x: 30, y: 60, z: 40 });
    g.fill([10, 10, 10], [20, 20, 20], TISSUE.cancellousBone, 'L3');
    g.fill([0, 21, 0], [29, 59, 39], TISSUE.muscle, null);
    expect(cropToRegion(g.vol, 'lumbosacral').box.hi[1]).toBe(59);
  });

  it('rejects a region with none of its levels in the scan, naming the levels', () => {
    const { vol } = fiveVertebrae();
    expect(() => cropToRegion(vol, 'cervical')).toThrow(/cervical.*none of its levels.*C1, C2/);
  });

  it('reports the region’s missing levels when some are present', () => {
    const { vol } = fiveVertebrae();
    const out = cropToRegion(vol, 'thoracic');
    expect(out.missingLevels).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10']);
  });
});
