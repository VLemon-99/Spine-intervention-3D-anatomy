// Test helper (not a test file): uniform test volumes in the standard layout
// (identity orientation, 1 mm voxels, centred on the origin).

import { TISSUE, type TissueId } from '../../src/core/labels';
import type { Volume } from '../../src/core/types';

/** A cube of `sizeMm` voxels per side (1 mm each) filled with one tissue label, centred on the origin. */
export function uniformVolume(tissueLabel: TissueId, sizeMm: number): Volume {
  const n = Math.max(1, Math.round(sizeMm));
  const half = (n - 1) / 2;
  const count = n * n * n;
  return {
    region: `uniform-${tissueLabel}`,
    size: { x: n, y: n, z: n },
    spacing: { x: 1, y: 1, z: 1 },
    origin: { x: -half, y: -half, z: -half },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity: new Uint8Array(count),
    labels: new Uint8Array(count).fill(tissueLabel),
  };
}

/** An all-air test volume (nothing drifts in air). */
export function airVolume(sizeMm = 301): Volume {
  return uniformVolume(TISSUE.air, sizeMm);
}
