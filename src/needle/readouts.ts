// Readout maths for the needle panel (F5.6). Plain TypeScript, no browser code.

import { createProjection } from '../core/geometry';
import type { CArmPose, NeedleState, Vec3 } from '../core/types';

/**
 * Angle in degrees between two LINES (0–90°), whichever way each vector
 * points. Null if either vector has no length.
 */
export function lineAngleDeg(a: Vec3, b: Vec3): number | null {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (!(la > 0) || !(lb > 0)) return null;
  const c = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/**
 * The angle between the needle's outside part (hub → entry point) and the
 * beam ray of `pose` from its source through the entry point, 0–90°.
 */
export function needleBeamAngleDeg(needle: NeedleState, pose: CArmPose): number | null {
  const hub = needle.shaft[0];
  const e = needle.entryPoint;
  const source = createProjection(pose).source;
  return lineAngleDeg(
    { x: e.x - hub.x, y: e.y - hub.y, z: e.z - hub.z },
    { x: e.x - source.x, y: e.y - source.y, z: e.z - source.z },
  );
}
