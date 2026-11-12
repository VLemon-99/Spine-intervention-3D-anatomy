// Blocky surface mesh around chosen tissue labels (F8.1).
//
// The mesh is made of the voxel faces that separate a voxel whose label is in
// the set from one that is not (voxels outside the grid count as not in the
// set). Each face is two triangles, wound counter-clockwise seen from outside,
// with normals pointing out of the set. Positions are patient coordinates in
// mm. Plain TypeScript: no browser code, so it is unit-testable.

import type { Volume } from '../core/types';

export interface SurfaceMesh {
  /** 3 floats per corner, 3 corners per triangle (non-indexed). */
  positions: Float32Array;
  /** One unit normal per corner, same layout as positions. */
  normals: Float32Array;
}

/** True when the volume uses the standard layout (voxel axes along +x, +y, +z). */
function isStandardLayout(volume: Volume): boolean {
  const [a, b, c] = volume.orientation;
  const eps = 1e-6;
  const near = (v: number, w: number): boolean => Math.abs(v - w) <= eps;
  return (
    near(a.x, 1) && near(a.y, 0) && near(a.z, 0) &&
    near(b.x, 0) && near(b.y, 1) && near(b.z, 0) &&
    near(c.x, 0) && near(c.y, 0) && near(c.z, 1)
  );
}

// For a face normal along axis a, the two other axes (u, v) such that
// u × v = +a, so corners (u−,v−) → (u+,v−) → (u+,v+) → (u−,v+) run
// counter-clockwise seen from the +a side.
const FACE_AXES: [number, number, number][] = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
];

/**
 * Builds the surface around every voxel whose label is in `labels`.
 * Throws for a volume that is not in the standard layout (identity orientation).
 */
export function buildSurface(volume: Volume, labels: readonly number[]): SurfaceMesh {
  if (!isStandardLayout(volume)) {
    throw new Error(
      `buildSurface: volume '${volume.region}' is not in the standard layout (identity orientation); convert it first`,
    );
  }
  const inSet = new Uint8Array(256);
  for (const l of labels) inSet[l & 255] = 1;

  const n = [volume.size.x, volume.size.y, volume.size.z];
  const spacing = [volume.spacing.x, volume.spacing.y, volume.spacing.z];
  const origin = [volume.origin.x, volume.origin.y, volume.origin.z];
  const stride = [1, n[0], n[0] * n[1]];
  const data = volume.labels;

  // Calls fn(axis, sign, i, j, k) for every boundary face.
  const forEachFace = (fn: (axis: number, sign: number, idx: number[]) => void): void => {
    const idx = [0, 0, 0];
    for (let k = 0; k < n[2]; k++) {
      idx[2] = k;
      for (let j = 0; j < n[1]; j++) {
        idx[1] = j;
        for (let i = 0; i < n[0]; i++) {
          idx[0] = i;
          const index = i + stride[1] * j + stride[2] * k;
          if (!inSet[data[index]]) continue;
          for (let axis = 0; axis < 3; axis++) {
            for (const sign of [-1, 1]) {
              const neighbour = idx[axis] + sign;
              const outside = neighbour < 0 || neighbour >= n[axis];
              if (outside || !inSet[data[index + sign * stride[axis]]]) fn(axis, sign, idx);
            }
          }
        }
      }
    }
  };

  let faces = 0;
  forEachFace(() => faces++);

  const positions = new Float32Array(faces * 18);
  const normals = new Float32Array(faces * 18);
  let o = 0;
  const corner = [0, 0, 0];
  const quad: number[][] = [[], [], [], []];

  forEachFace((axis, sign, idx) => {
    const [, u, v] = FACE_AXES[axis];
    const centre = [0, 1, 2].map((d) => origin[d] + idx[d] * spacing[d]);
    const steps: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (let q = 0; q < 4; q++) {
      corner[axis] = centre[axis] + (sign * spacing[axis]) / 2;
      corner[u] = centre[u] + (steps[q][0] * spacing[u]) / 2;
      corner[v] = centre[v] + (steps[q][1] * spacing[v]) / 2;
      quad[q] = [corner[0], corner[1], corner[2]];
    }
    // Counter-clockwise for +axis; reversed for −axis.
    const order = sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const q of order) {
      positions[o] = quad[q][0];
      positions[o + 1] = quad[q][1];
      positions[o + 2] = quad[q][2];
      normals[o + axis] = sign;
      o += 3;
    }
  });

  return { positions, normals };
}
