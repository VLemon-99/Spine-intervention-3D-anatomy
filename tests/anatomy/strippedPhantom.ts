// Test helper: the phantom with its modelled soft tissue removed — ligamentum
// flavum, epidural space, nerve root, artery, vein and joint-space voxels turned
// back into muscle; bone, disc, thecal sac and spinal cord kept.
import { TISSUE } from '../../src/core/labels';
import { createPhantom } from '../../src/core/phantom';
import type { Volume } from '../../src/core/types';

const MODELLED: ReadonlySet<number> = new Set([
  TISSUE.ligamentumFlavum,
  TISSUE.epiduralSpace,
  TISSUE.nerveRoot,
  TISSUE.artery,
  TISSUE.vein,
  TISSUE.jointSpace,
]);

export function createStrippedPhantom(options: { removeSac?: boolean } = {}): Volume {
  const vol = createPhantom();
  const removeSac = options.removeSac ?? false;
  for (let v = 0; v < vol.labels.length; v++) {
    const l = vol.labels[v];
    if (MODELLED.has(l) || (removeSac && (l === TISSUE.thecalSac || l === TISSUE.spinalCord))) vol.labels[v] = TISSUE.muscle;
  }
  return vol;
}
