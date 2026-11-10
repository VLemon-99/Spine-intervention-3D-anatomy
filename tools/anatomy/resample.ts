// Resample a standard-layout volume to a target voxel spacing (SPEC F1.1, F1.5).
// Intensity: straight-line (trilinear) interpolation. Labels and levels: nearest
// voxel, so no in-between labels are made up. The first voxel centre stays where
// it was (origin unchanged), so the anatomy does not shift.
import type { Size3 } from './standardLayout';

/** Default target voxel size (mm) on every axis — a converter setting. */
export const DEFAULT_TARGET_SPACING_MM = 1.0;

export interface ResampleInput {
  size: Size3;
  spacing: Size3;
  origin: Size3;
  intensity: Uint8Array;
  labels: Uint8Array;
  levels?: Uint8Array;
}

export type ResampleOutput = ResampleInput;

/** Checks a target spacing (a number for all axes, or one per axis). */
export function checkTargetSpacing(target: number | Size3): Size3 {
  const t = typeof target === 'number' ? { x: target, y: target, z: target } : target;
  for (const axis of ['x', 'y', 'z'] as const) {
    const v = t?.[axis];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new Error(`Target voxel spacing must be a positive number of mm (got ${String(v)} for ${axis})`);
    }
  }
  return { x: t.x, y: t.y, z: t.z };
}

export function resampleVolume(vol: ResampleInput, target: number | Size3 = DEFAULT_TARGET_SPACING_MM): ResampleOutput {
  const t = checkTargetSpacing(target);
  const n = [vol.size.x, vol.size.y, vol.size.z];
  const s = [vol.spacing.x, vol.spacing.y, vol.spacing.z];
  const ts = [t.x, t.y, t.z];
  const count = n[0] * n[1] * n[2];
  for (const [name, arr] of [['intensity', vol.intensity], ['labels', vol.labels], ['levels', vol.levels]] as const) {
    if (arr && arr.length !== count) throw new Error(`${name} has ${arr.length} voxels but the volume size needs ${count}`);
  }

  const same = s.every((v, a) => Math.abs(v - ts[a]) < 1e-9);
  if (same) {
    return {
      size: { ...vol.size },
      spacing: { ...vol.spacing },
      origin: { ...vol.origin },
      intensity: vol.intensity.slice(),
      labels: vol.labels.slice(),
      ...(vol.levels ? { levels: vol.levels.slice() } : {}),
    };
  }

  // Output voxels cover the same span of voxel centres, starting at the same first centre.
  const m = n.map((len, a) => Math.floor(((len - 1) * s[a]) / ts[a] + 1e-9) + 1);
  // For each output index along each axis: input position (in input voxels).
  const pos = m.map((len, a) => Float64Array.from({ length: len }, (_, o) => Math.min(n[a] - 1, (o * ts[a]) / s[a])));
  const lo = pos.map((p) => Int32Array.from(p, (x) => Math.floor(x)));
  const hi = lo.map((l, a) => Int32Array.from(l, (x) => Math.min(n[a] - 1, x + 1)));
  const fr = pos.map((p, a) => Float64Array.from(p, (x, o) => x - lo[a][o]));
  const near = pos.map((p, a) => Int32Array.from(p, (x) => Math.min(n[a] - 1, Math.round(x))));

  const outCount = m[0] * m[1] * m[2];
  const intensity = new Uint8Array(outCount);
  const labels = new Uint8Array(outCount);
  const levels = vol.levels ? new Uint8Array(outCount) : undefined;
  const nx = n[0];
  const nxy = n[0] * n[1];
  const src = vol.intensity;

  let v = 0;
  for (let k = 0; k < m[2]; k++) {
    const k0 = lo[2][k] * nxy;
    const k1 = hi[2][k] * nxy;
    const fz = fr[2][k];
    const kn = near[2][k] * nxy;
    for (let j = 0; j < m[1]; j++) {
      const j0 = lo[1][j] * nx;
      const j1 = hi[1][j] * nx;
      const fy = fr[1][j];
      const jn = near[1][j] * nx;
      for (let i = 0; i < m[0]; i++, v++) {
        const i0 = lo[0][i];
        const i1 = hi[0][i];
        const fx = fr[0][i];
        const c00 = src[i0 + j0 + k0] * (1 - fx) + src[i1 + j0 + k0] * fx;
        const c10 = src[i0 + j1 + k0] * (1 - fx) + src[i1 + j1 + k0] * fx;
        const c01 = src[i0 + j0 + k1] * (1 - fx) + src[i1 + j0 + k1] * fx;
        const c11 = src[i0 + j1 + k1] * (1 - fx) + src[i1 + j1 + k1] * fx;
        const c0 = c00 * (1 - fy) + c10 * fy;
        const c1 = c01 * (1 - fy) + c11 * fy;
        intensity[v] = Math.round(c0 * (1 - fz) + c1 * fz);
        const nearest = near[0][i] + jn + kn;
        labels[v] = vol.labels[nearest];
        if (levels) levels[v] = vol.levels![nearest];
      }
    }
  }

  return {
    size: { x: m[0], y: m[1], z: m[2] },
    spacing: { ...t },
    origin: { ...vol.origin },
    intensity,
    labels,
    ...(levels ? { levels } : {}),
  };
}
