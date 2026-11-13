// Where a beam ray meets the skin (F5.2). Plain TypeScript, no browser code.
//
// The ray comes from geometry.unproject: it starts at the X-ray source (under
// the table, in front of the prone patient) and points toward the detector.
// The needle goes in from the back, which faces the detector, so the walk
// starts where the ray leaves the grid on the detector side and goes back
// toward the source. The first tissue (non-air) point is the skin entry.

import { TISSUE } from '../core/labels';
import type { Ray } from '../core/geometry';
import type { Vec3, Volume } from '../core/types';
import { assertStandardLayout, labelAt } from './sample';

/** How close (mm) the refined hit is to the true air/tissue boundary along the ray. */
const REFINE_MM = 0.1;

const along = (r: Ray, t: number): Vec3 => ({
  x: r.origin.x + r.direction.x * t,
  y: r.origin.y + r.direction.y * t,
  z: r.origin.z + r.direction.z * t,
});

/** Ray parameters [tEnter, tExit] where the ray is inside the voxel grid's box, or null if it misses. */
function gridSpan(volume: Volume, ray: Ray): [number, number] | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const lo = volume.origin[axis] - volume.spacing[axis] / 2;
    const hi = volume.origin[axis] + (volume.size[axis] - 0.5) * volume.spacing[axis];
    const o = ray.origin[axis];
    const d = ray.direction[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const a = (lo - o) / d;
    const b = (hi - o) / d;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
  }
  if (tMax < tMin) return null;
  return [Math.max(tMin, 0), tMax];
}

/**
 * The skin entry point on the detector side: the first non-air point met when
 * walking from the grid's detector-side edge back toward the source along the
 * ray. Null if the ray meets no tissue inside the grid.
 */
export function skinEntry(volume: Volume, ray: Ray): Vec3 | null {
  assertStandardLayout(volume);
  const span = gridSpan(volume, ray);
  if (!span) return null;
  const [tEnter, tExit] = span;
  const step = Math.min(volume.spacing.x, volume.spacing.y, volume.spacing.z) / 2;
  const isTissue = (t: number) => labelAt(volume, along(ray, t)) !== TISSUE.air;

  let airT = tExit;
  if (isTissue(airT)) return along(ray, airT);
  for (let t = tExit - step; ; t -= step) {
    const tt = Math.max(t, tEnter);
    if (isTissue(tt)) {
      // Halve the last step until the boundary is pinned to within REFINE_MM.
      let tissueT = tt;
      while (airT - tissueT > REFINE_MM) {
        const mid = (airT + tissueT) / 2;
        if (isTissue(mid)) tissueT = mid;
        else airT = mid;
      }
      return along(ray, tissueT);
    }
    airT = tt;
    if (tt <= tEnter) return null;
  }
}
