import { describe, expect, it } from 'vitest';
import { TISSUE, TISSUE_LABELS, isBone } from '../../src/core/labels';
import { PHANTOM_TEST_POINTS, createPhantom } from '../../src/core/phantom';
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
