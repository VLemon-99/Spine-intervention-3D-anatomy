import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, NO_LEVEL, TISSUE, TISSUE_LABELS, isBone } from '../../src/core/labels';
import { PHANTOM_TEST_POINTS, createPhantom, createPhantomLandmarks } from '../../src/core/phantom';
import type { Landmarks, Vec3 } from '../../src/core/types';
import { forEachVoxelNear, voxelCentre, voxelIndexAt } from './phantomHelpers';

const phantom = createPhantom();
const { x: nx, y: ny, z: nz } = phantom.size;
const labelAt = (p: { x: number; y: number; z: number }): number => {
  const index = voxelIndexAt(phantom, p);
  expect(index, `point ${JSON.stringify(p)} is outside the phantom`).toBeGreaterThanOrEqual(0);
  return phantom.labels[index] ?? -1;
};

describe('synthetic phantom: layout and labels', () => {
  it('is no larger than 128×128×128 voxels with positive spacing in mm', () => {
    for (const n of [nx, ny, nz]) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(128);
    }
    for (const s of [phantom.spacing.x, phantom.spacing.y, phantom.spacing.z]) expect(s).toBeGreaterThan(0);
    expect(phantom.labels.length).toBe(nx * ny * nz);
    expect(phantom.intensity.length).toBe(nx * ny * nz);
    expect(phantom.region).toBe('phantom');
  });

  it('contains every tissue label from labels.ts', () => {
    const present = new Set(phantom.labels);
    for (const t of TISSUE_LABELS) expect(present.has(t.id), `missing ${t.key}`).toBe(true);
  });

  it('on the midline test line, back to front: skin/fat, muscle, ligamentum flavum, epidural space, thecal sac', () => {
    const { start, end } = PHANTOM_TEST_POINTS.midlineLine;
    expect(start.y).toBeGreaterThan(end.y); // starts at the back (+y)
    const firstSeen: number[] = [];
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) / 0.25);
    for (let n = 0; n <= steps; n++) {
      const t = n / steps;
      const label = labelAt({
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
        z: start.z + t * (end.z - start.z),
      });
      if (!firstSeen.includes(label)) firstSeen.push(label);
    }
    const wanted = [TISSUE.skinFat, TISSUE.muscle, TISSUE.ligamentumFlavum, TISSUE.epiduralSpace, TISSUE.thecalSac];
    const order = wanted.map((id) => firstSeen.indexOf(id));
    for (const position of order) expect(position).toBeGreaterThanOrEqual(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has bone at each vertebra block centre', () => {
    for (const centre of [PHANTOM_TEST_POINTS.blockCentres.upper, PHANTOM_TEST_POINTS.blockCentres.lower]) {
      expect(isBone(labelAt(centre))).toBe(true);
    }
    expect(PHANTOM_TEST_POINTS.blockCentres.upper.z).toBeGreaterThan(PHANTOM_TEST_POINTS.blockCentres.lower.z);
  });

  it('has nerve root voxels within 3 mm of both foramen centres; the left one has x > 0', () => {
    const { left, right } = PHANTOM_TEST_POINTS.foramenCentres;
    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(0);
    for (const centre of [left, right]) {
      let nerveVoxels = 0;
      forEachVoxelNear(phantom, centre, 3, (index) => {
        if (phantom.labels[index] === TISSUE.nerveRoot) nerveVoxels++;
      });
      expect(nerveVoxels).toBeGreaterThan(0);
    }
  });

  it('has bone of both blocks within 3 mm of every joint space voxel', () => {
    // The upper block lies entirely at z > 0 and the lower block at z < 0 (documented in phantom.ts).
    let jointVoxels = 0;
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          if (phantom.labels[i + nx * (j + ny * k)] !== TISSUE.jointSpace) continue;
          jointVoxels++;
          let upperBone = false;
          let lowerBone = false;
          forEachVoxelNear(phantom, voxelCentre(phantom, i, j, k), 3, (index) => {
            if (!isBone(phantom.labels[index] ?? 0)) return;
            const kk = Math.floor(index / (nx * ny));
            const z = phantom.origin.z + kk * phantom.spacing.z;
            if (z > 0) upperBone = true;
            if (z < 0) lowerBone = true;
          });
          expect(upperBone && lowerBone, `joint voxel ${i},${j},${k}`).toBe(true);
        }
      }
    }
    expect(jointVoxels).toBeGreaterThan(0);
  });

  it('has only air in the outermost 3 voxel layers', () => {
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const edge = Math.min(i, j, k, nx - 1 - i, ny - 1 - j, nz - 1 - k) < 3;
          if (edge && phantom.labels[i + nx * (j + ny * k)] !== TISSUE.air) {
            throw new Error(`voxel ${i},${j},${k} at the edge is not air`);
          }
        }
      }
    }
  });

  it('is deterministic: two calls give identical volumes', () => {
    const again = createPhantom();
    expect(again.size).toEqual(phantom.size);
    expect(again.spacing).toEqual(phantom.spacing);
    expect(again.origin).toEqual(phantom.origin);
    expect(Buffer.from(again.labels).equals(Buffer.from(phantom.labels))).toBe(true);
    expect(Buffer.from(again.intensity).equals(Buffer.from(phantom.intensity))).toBe(true);
  });
});

describe('synthetic phantom: intensity, levels and landmarks', () => {
  const levels = phantom.levels;
  const landmarks: Landmarks = createPhantomLandmarks();
  const levelAt = (p: Vec3): number => levels?.[voxelIndexAt(phantom, p)] ?? -1;

  it('makes bone brighter on average than muscle, and muscle brighter than air', () => {
    const sum = { bone: 0, muscle: 0, air: 0 };
    const count = { bone: 0, muscle: 0, air: 0 };
    phantom.labels.forEach((label, index) => {
      const value = phantom.intensity[index] ?? 0;
      const group = isBone(label) ? 'bone' : label === TISSUE.muscle ? 'muscle' : label === TISSUE.air ? 'air' : null;
      if (!group) return;
      sum[group] += value;
      count[group]++;
    });
    const mean = (g: keyof typeof sum): number => sum[g] / count[g];
    expect(mean('bone')).toBeGreaterThan(mean('muscle'));
    expect(mean('muscle')).toBeGreaterThan(mean('air'));
  });

  it('gives every bone voxel a level and no other voxel one', () => {
    expect(levels).toBeDefined();
    expect(levels?.length).toBe(phantom.labels.length);
    phantom.labels.forEach((label, index) => {
      const level = levels?.[index] ?? NO_LEVEL;
      if (isBone(label) !== (level !== NO_LEVEL)) throw new Error(`voxel ${index}: label ${label}, level ${level}`);
    });
  });

  it('gives each block centre its level (L4 upper, L5 lower)', () => {
    expect(levelAt(PHANTOM_TEST_POINTS.blockCentres.upper)).toBe(LEVEL_IDS.L4);
    expect(levelAt(PHANTOM_TEST_POINTS.blockCentres.lower)).toBe(LEVEL_IDS.L5);
  });

  it('has landmarks for region "phantom" with entries for L4 and L5', () => {
    expect(landmarks.region).toBe('phantom');
    expect(landmarks.levels.map((l) => l.level).sort()).toEqual(['L4', 'L5']);
  });

  it('has bone of the right level at every body centre and pedicle centre', () => {
    for (const entry of landmarks.levels) {
      for (const p of [entry.bodyCentre, entry.pedicleCentre.left, entry.pedicleCentre.right]) {
        expect(isBone(labelAt(p)), `${entry.level} ${JSON.stringify(p)}`).toBe(true);
        expect(levelAt(p)).toBe(LEVEL_IDS[entry.level]);
      }
    }
  });

  it('lists the foramen centres under L4, equal to the test points, and not in bone', () => {
    const l4 = landmarks.levels.find((l) => l.level === 'L4');
    expect(l4?.foramenCentre?.left).toEqual(PHANTOM_TEST_POINTS.foramenCentres.left);
    expect(l4?.foramenCentre?.right).toEqual(PHANTOM_TEST_POINTS.foramenCentres.right);
    for (const p of [l4?.foramenCentre?.left, l4?.foramenCentre?.right]) {
      expect(p).toBeDefined();
      if (p) expect(isBone(labelAt(p))).toBe(false);
    }
  });

  it('has unit endplate tilt directions, with the superior endplate above the inferior one', () => {
    for (const entry of landmarks.levels) {
      for (const plate of [entry.superiorEndplate, entry.inferiorEndplate]) {
        expect(Math.abs(Math.hypot(plate.normal.x, plate.normal.y, plate.normal.z) - 1)).toBeLessThan(0.001);
      }
      expect(entry.superiorEndplate.centre.z).toBeGreaterThan(entry.inferiorEndplate.centre.z);
    }
  });

  it('fills every landmark field with finite numbers', () => {
    for (const entry of landmarks.levels) {
      const points = [
        entry.bodyCentre,
        entry.pedicleCentre.left,
        entry.pedicleCentre.right,
        entry.superiorEndplate.centre,
        entry.inferiorEndplate.centre,
        entry.superiorArticularProcessTip.left,
        entry.superiorArticularProcessTip.right,
      ];
      for (const p of points) for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('is deterministic: two calls give identical levels and landmarks', () => {
    const again = createPhantom();
    expect(again.levels && levels && Buffer.from(again.levels).equals(Buffer.from(levels))).toBe(true);
    expect(createPhantomLandmarks()).toEqual(landmarks);
  });
});
