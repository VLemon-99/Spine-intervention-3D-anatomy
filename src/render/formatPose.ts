// The wording of the pose text on the fluoro image (docs/SPEC.md F2.9).
// Plain function, no browser code. Only the two angles are shown, not the
// table position (owner decision 2026-11-10).
import type { CArmPose } from '../core/types';

/**
 * e.g. 'OBL R 25° · CRAN 10°'. Positive oblique = right, negative = left,
 * 0 = 'AP'; positive tilt = cranial, negative = caudal, 0 = 'TILT 0°'.
 * Angles are rounded to whole degrees.
 */
export function formatPose(pose: CArmPose): string {
  const oblique = Math.round(pose.oblique);
  const tilt = Math.round(pose.tilt);
  const obliqueText = oblique > 0 ? `OBL R ${oblique}°` : oblique < 0 ? `OBL L ${-oblique}°` : 'AP';
  const tiltText = tilt > 0 ? `CRAN ${tilt}°` : tilt < 0 ? `CAUD ${-tilt}°` : 'TILT 0°';
  return `${obliqueText} · ${tiltText}`;
}
