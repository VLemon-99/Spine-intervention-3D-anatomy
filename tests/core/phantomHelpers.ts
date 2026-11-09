// Small helpers for phantom tests (not a test file itself).
import type { Vec3, Volume } from '../../src/core/types';

/** Index of the voxel nearest to a patient point, or -1 outside the volume (identity orientation). */
export function voxelIndexAt(volume: Volume, p: Vec3): number {
  const i = Math.round((p.x - volume.origin.x) / volume.spacing.x);
  const j = Math.round((p.y - volume.origin.y) / volume.spacing.y);
  const k = Math.round((p.z - volume.origin.z) / volume.spacing.z);
  const { x: nx, y: ny, z: nz } = volume.size;
  if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return -1;
  return i + nx * (j + ny * k);
}

/** Patient position of the centre of voxel (i, j, k) (identity orientation). */
export function voxelCentre(volume: Volume, i: number, j: number, k: number): Vec3 {
  return {
    x: volume.origin.x + i * volume.spacing.x,
    y: volume.origin.y + j * volume.spacing.y,
    z: volume.origin.z + k * volume.spacing.z,
  };
}

/** Calls fn for every voxel index within `radius` mm of p. */
export function forEachVoxelNear(volume: Volume, p: Vec3, radius: number, fn: (index: number) => void): void {
  const { x: nx, y: ny, z: nz } = volume.size;
  const s = volume.spacing;
  const ci = (p.x - volume.origin.x) / s.x;
  const cj = (p.y - volume.origin.y) / s.y;
  const ck = (p.z - volume.origin.z) / s.z;
  for (let k = Math.max(0, Math.floor(ck - radius / s.z)); k <= Math.min(nz - 1, Math.ceil(ck + radius / s.z)); k++) {
    for (let j = Math.max(0, Math.floor(cj - radius / s.y)); j <= Math.min(ny - 1, Math.ceil(cj + radius / s.y)); j++) {
      for (let i = Math.max(0, Math.floor(ci - radius / s.x)); i <= Math.min(nx - 1, Math.ceil(ci + radius / s.x)); i++) {
        const c = voxelCentre(volume, i, j, k);
        if (Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) <= radius) fn(i + nx * (j + ny * k));
      }
    }
  }
}
