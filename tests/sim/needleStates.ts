// Test helper (not a test file): hand-made needle states for the sim zone's tests.

import type { NeedleState, Vec3 } from '../../src/core/types';

/** A straight needle state whose tip is at `tip`, entering from 40 mm behind it (+y). */
export function needleAt(tip: Vec3, extra: Partial<NeedleState> = {}): NeedleState {
  const entryPoint = { x: tip.x, y: tip.y + 40, z: tip.z };
  return {
    needleId: 'quincke-22g-89',
    preBend: 0,
    entryPoint,
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    insertedDepth: 40,
    shaft: [entryPoint, { ...tip }],
    tip: { ...tip },
    ...extra,
  };
}
