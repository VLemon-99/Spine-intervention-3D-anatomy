import { describe, expect, it } from 'vitest';
import { applyLayoutPlan, planStandardLayout, toStandardLayout } from '../../tools/anatomy/standardLayout';

// A small asymmetric volume already in the standard layout (i → left, j → back, k → head).
const STD = { size: [4, 3, 2], spacing: [0.5, 1.5, 3], origin: [-10, 20, -30] };
const N = 4 * 3 * 2;
const stdData = Float32Array.from({ length: N }, (_, n) => n * 7 + 1);
const stdIndex = (i: number, j: number, k: number) => i + 4 * (j + 3 * k);

/**
 * Stores the standard volume another way. Stored axis a runs along patient
 * (app) axis perm[a], in direction sign[a]. Returns the stored array and its
 * RAS affine, as a NIfTI file would hold them.
 */
function storeAs(perm: number[], sign: number[]) {
  const inSize = perm.map((p) => STD.size[p]);
  const data = new Float32Array(N);
  for (let m2 = 0; m2 < inSize[2]; m2++)
    for (let m1 = 0; m1 < inSize[1]; m1++)
      for (let m0 = 0; m0 < inSize[0]; m0++) {
        const m = [m0, m1, m2];
        const n = [0, 0, 0];
        for (let a = 0; a < 3; a++) n[perm[a]] = sign[a] > 0 ? m[a] : inSize[a] - 1 - m[a];
        data[m0 + inSize[0] * (m1 + inSize[1] * m2)] = stdData[stdIndex(n[0], n[1], n[2])];
      }
  // App-frame affine: column a = sign * spacing along perm[a]; offset = position of stored (0,0,0).
  const app = [0, 1, 2].map(() => [0, 0, 0, 0]);
  const offset = [...STD.origin];
  for (let a = 0; a < 3; a++) {
    const p = perm[a];
    app[p][a] = sign[a] * STD.spacing[p];
    if (sign[a] < 0) offset[p] += (inSize[a] - 1) * STD.spacing[p];
  }
  for (let p = 0; p < 3; p++) app[p][3] = offset[p];
  // App → RAS: x and y flip.
  const affine = app.map((row, r) => row.map((v) => (r < 2 ? -v : v)));
  affine.push([0, 0, 0, 1]);
  return { size: { x: inSize[0], y: inSize[1], z: inSize[2] }, affine, data };
}

const LAYOUTS: Record<string, [number[], number[]]> = {
  RAS: [[0, 1, 2], [-1, -1, 1]],
  LPS: [[0, 1, 2], [1, 1, 1]],
  'axes swapped (k, x, y)': [[2, 0, 1], [1, -1, -1]],
  'axes swapped (y, z, x)': [[1, 2, 0], [-1, 1, -1]],
};

function rotZ(deg: number) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

describe('toStandardLayout', () => {
  it('gives exactly the same voxels, spacing and origin from four different storage orders', () => {
    for (const [name, [perm, sign]] of Object.entries(LAYOUTS)) {
      const out = toStandardLayout(storeAs(perm, sign));
      expect(out.size, name).toEqual({ x: 4, y: 3, z: 2 });
      expect(Array.from(out.data), name).toEqual(Array.from(stdData));
      expect(out.spacing.x, name).toBeCloseTo(0.5, 9);
      expect(out.spacing.y, name).toBeCloseTo(1.5, 9);
      expect(out.spacing.z, name).toBeCloseTo(3, 9);
      expect(out.origin.x, name).toBeCloseTo(-10, 9);
      expect(out.origin.y, name).toBeCloseTo(20, 9);
      expect(out.origin.z, name).toBeCloseTo(-30, 9);
    }
  });

  it('puts the voxel at the patient’s left-back-head corner at the highest i, j and k', () => {
    // RAS storage, 1 mm voxels: i grows toward the right, j toward the front, k toward the head,
    // so left-back-head is stored at (0, 0, last k).
    const size = { x: 3, y: 4, z: 5 };
    const data = new Uint8Array(60);
    data[0 + 3 * (0 + 4 * 4)] = 99;
    const affine = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const out = toStandardLayout({ size, affine, data });
    expect(out.data).toBeInstanceOf(Uint8Array);
    expect(out.data[2 + 3 * (3 + 4 * 4)]).toBe(99);
    expect(Array.from(out.data).filter((v) => v === 99)).toHaveLength(1);
    // That corner is the most left (+x), most back (+y), most head (+z) voxel in app coordinates.
    expect(out.origin).toEqual({ x: -2, y: -3, z: 0 });
  });

  it('carries each axis’s own spacing through the reordering', () => {
    const stored = storeAs([2, 0, 1], [1, -1, -1]);
    expect(stored.size).toEqual({ x: 2, y: 4, z: 3 });
    const out = toStandardLayout(stored);
    expect(out.size).toEqual({ x: 4, y: 3, z: 2 });
    const plan = planStandardLayout(stored.size, stored.affine);
    // Stored axis 0 (spacing 3) is the head axis, 1 (0.5) left/right, 2 (1.5) back/front.
    expect(plan.fromAxis).toEqual([1, 2, 0]);
    expect(out.spacing.x).toBeCloseTo(0.5, 9);
    expect(out.spacing.y).toBeCloseTo(1.5, 9);
    expect(out.spacing.z).toBeCloseTo(3, 9);
  });

  it('rejects an affine tilted by 20° with a clear error, and accepts one tilted by 1°', () => {
    const size = { x: 2, y: 2, z: 2 };
    const data = new Uint8Array(8).map((_, n) => n);
    expect(() => toStandardLayout({ size, affine: rotZ(20), data })).toThrow(/oblique.*20\.0°/i);
    const out = toStandardLayout({ size, affine: rotZ(1), data });
    expect(out.size).toEqual(size);
  });

  it('uses one plan for the CT and its masks, so they stay lined up', () => {
    const stored = storeAs([1, 2, 0], [-1, 1, -1]);
    const plan = planStandardLayout(stored.size, stored.affine);
    const mask = Uint8Array.from(stored.data, (v) => v % 256);
    expect(Array.from(applyLayoutPlan(plan, mask))).toEqual(Array.from(stdData, (v) => v % 256));
  });

  it('rejects a voxel array whose length does not match the size', () => {
    const plan = planStandardLayout({ x: 2, y: 2, z: 2 }, rotZ(0));
    expect(() => applyLayoutPlan(plan, new Uint8Array(7))).toThrow(/7 values/);
  });
});
