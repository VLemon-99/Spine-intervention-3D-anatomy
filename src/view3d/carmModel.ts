// Where the C-arm's parts are for a pose (F8.1, F8.2): the X-ray source, the
// detector centre and the detector's four corners, all in patient
// coordinates (mm), straight from the shared projection geometry. Plain
// TypeScript, no browser code.

import { DETECTOR_SIZE_MM, createProjection } from '../core/geometry';
import type { CArmPose, Vec3 } from '../core/types';

export interface CarmModel {
  source: Vec3;
  detectorCentre: Vec3;
  /** Detector corners as seen on the image: top-left, top-right, bottom-right, bottom-left. */
  detectorCorners: [Vec3, Vec3, Vec3, Vec3];
}

export function carmModel(pose: CArmPose): CarmModel {
  const projection = createProjection(pose);
  const { detectorCentre: c, detectorRight: r, detectorUp: u } = projection;
  const half = DETECTOR_SIZE_MM / 2;
  const corner = (right: number, up: number): Vec3 => ({
    x: c.x + half * (right * r.x + up * u.x),
    y: c.y + half * (right * r.y + up * u.y),
    z: c.z + half * (right * r.z + up * u.z),
  });
  return {
    source: { ...projection.source },
    detectorCentre: { ...c },
    detectorCorners: [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)],
  };
}
