// Tissue at the needle tip (F6.1). The sim zone's own copy of the label
// look-up (zones do not import each other). Plain TypeScript, no browser code.

import { TISSUE, TISSUE_LABELS, type TissueLabel } from '../core/labels';
import type { NeedleState, Vec3, Volume } from '../core/types';
import { tissues } from './data';

const AXES: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

/** Throws unless the volume uses the standard layout (identity orientation, decision 2026-11-10). */
export function assertStandardLayout(volume: Volume): void {
  volume.orientation.forEach((axis, i) => {
    const want = AXES[i];
    if (
      Math.abs(axis.x - want.x) > 1e-9 ||
      Math.abs(axis.y - want.y) > 1e-9 ||
      Math.abs(axis.z - want.z) > 1e-9
    ) {
      throw new Error(
        `Volume "${volume.region}" is not in the standard layout: its orientation must be the identity (voxel axes along +x, +y, +z)`,
      );
    }
  });
}

/** The tissue label id of the voxel nearest to a patient point (mm). Points outside the grid are air. */
export function labelAt(volume: Volume, point: Vec3): number {
  assertStandardLayout(volume);
  const i = Math.round((point.x - volume.origin.x) / volume.spacing.x);
  const j = Math.round((point.y - volume.origin.y) / volume.spacing.y);
  const k = Math.round((point.z - volume.origin.z) / volume.spacing.z);
  const { size } = volume;
  if (!(i >= 0 && j >= 0 && k >= 0 && i < size.x && j < size.y && k < size.z)) return TISSUE.air;
  return volume.labels[i + size.x * (j + size.y * k)];
}

/** A tissue label entry plus its resistance (0–1) from tissues.json. */
export interface TipTissue extends TissueLabel {
  resistance: number;
}

const AIR_LABEL = TISSUE_LABELS[TISSUE.air];

/** The tissue label entry for an id; an unknown id counts as air. */
export function tissueLabel(id: number): TissueLabel {
  return TISSUE_LABELS.find((label) => label.id === id) ?? AIR_LABEL;
}

/** The tissue at a point, with its resistance. */
export function tissueAt(volume: Volume, point: Vec3): TipTissue {
  const label = tissueLabel(labelAt(volume, point));
  return { ...label, resistance: tissues.resistance[label.key] };
}

/** The tissue at the needle's tip, with its resistance. */
export function tipTissue(needle: NeedleState, volume: Volume): TipTissue {
  return tissueAt(volume, needle.tip);
}
