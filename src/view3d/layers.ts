// The see-through layers of the 3D view (F8.4, owner decision 2026-11-11).
// Bone (cortical and cancellous) is the always-shown 'bone' object; every
// other tissue label belongs to exactly one of the four layers below.
// Plain data, no browser code.

import { TISSUE } from '../core/labels';

/** Labels drawn as the always-shown bone surface. */
export const BONE_LABELS: readonly number[] = [TISSUE.corticalBone, TISSUE.cancellousBone];

export type LayerId = 'nerves' | 'vessels' | 'thecal' | 'soft';

export interface Layer {
  id: LayerId;
  /** Button label (F8-S8). */
  name: string;
  /** Tissue labels whose surface this layer shows. */
  labels: readonly number[];
  /** Surface colour (0xRRGGBB). */
  colour: number;
  /** 1 = solid; below 1 = see-through. */
  opacity: number;
  /** Shown when the view starts. */
  startVisible: boolean;
}

export const LAYERS: readonly Layer[] = [
  { id: 'nerves', name: 'Nerves', labels: [TISSUE.nerveRoot], colour: 0xffd24a, opacity: 1, startVisible: true },
  { id: 'vessels', name: 'Vessels', labels: [TISSUE.artery, TISSUE.vein], colour: 0xe0453a, opacity: 1, startVisible: true },
  {
    id: 'thecal',
    name: 'Thecal sac',
    labels: [TISSUE.thecalSac, TISSUE.spinalCord],
    colour: 0x5aa0ff,
    opacity: 0.6,
    startVisible: true,
  },
  {
    id: 'soft',
    name: 'Soft tissue',
    labels: [
      TISSUE.skinFat,
      TISSUE.muscle,
      TISSUE.disc,
      TISSUE.ligamentumFlavum,
      TISSUE.epiduralSpace,
      TISSUE.jointSpace,
    ],
    colour: 0xd99a8a,
    opacity: 0.2,
    startVisible: false,
  },
];

/** Scene object name of a layer, e.g. 'layer-nerves'. */
export function layerObjectName(id: LayerId): string {
  return `layer-${id}`;
}
