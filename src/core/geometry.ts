// C-arm projection geometry (docs/SPEC.md F0.5, F3.1).
//
// Turns a CArmPose into the X-ray source position, the detector plane and a
// 512×512 pixel grid, and provides project(point) → pixel and
// unproject(pixel) → ray. All inputs and outputs are in PATIENT coordinates
// (mm): +x = patient's left, +y = posterior (toward the back), +z = head.
// Angles are degrees in the public API; radians only inside this file.
//
// Frames
// - The isocentre (the point the C-arm rotates around) is the origin of the
//   table-relative frame. Table offsets move the patient relative to it:
//   a patient point p sits at p + (tableLeftRight, tableHeight, tableHeadFoot)
//   in the table frame, so the isocentre is at −offsets in patient coordinates.
// - Pose (0°, 0°): a straight AP beam for the prone patient. The source is
//   under the table (anterior, −y) and the detector above the back (+y); the
//   central ray points along +y.
// - Oblique (rotation about the patient's long axis, z): positive = RIGHT. The
//   detector swings toward the patient's right (−x) and the source toward the
//   left. At +90° the detector is on the patient's right (lateral beam).
// - Tilt (cranial/caudal, rotation about the left–right axis, x): positive =
//   CRANIAL. The detector tilts toward the head (+z) and the source toward the
//   feet. Negative = caudal. Tilt is applied first, then oblique.
//
// Image orientation (before any display flips, which are F2.7)
// - Pixel coordinates: x = column (0 at the left edge, grows to the right),
//   y = row (0 at the top edge, grows downward). Pixel (i, j) covers
//   [i, i+1) × [j, j+1); its centre is (i + 0.5, j + 0.5). The image centre is
//   (256, 256).
// - At pose (0°, 0°) image UP is the patient's head (+z) and image RIGHT is the
//   patient's right (−x): the image is seen from the detector side, as when
//   standing behind the prone patient's back. Both axes turn with the C-arm.

import type { CArmPose, Vec3 } from './types';

/** Source-to-image (detector) distance of a typical mobile C-arm, mm. */
export const SOURCE_TO_DETECTOR_MM = 1000;
/** Source-to-isocentre distance of a typical mobile C-arm, mm. */
export const SOURCE_TO_ISOCENTRE_MM = 650;
/** Side length of the square detector (typical 30 cm flat panel), mm. */
export const DETECTOR_SIZE_MM = 300;
/** Image width and height in pixels. */
export const IMAGE_SIZE_PX = 512;

export interface Pixel {
  x: number;
  y: number;
}

export interface Ray {
  /** Start of the ray (the X-ray source), patient coordinates, mm. */
  origin: Vec3;
  /** Unit direction from the source toward the detector. */
  direction: Vec3;
}

export interface Projection {
  pose: CArmPose;
  /** Image size in pixels. */
  width: number;
  height: number;
  /** Size of one pixel on the detector, mm. */
  pixelSizeMm: number;
  /** Isocentre in patient coordinates. */
  isocentre: Vec3;
  /** X-ray source position. */
  source: Vec3;
  /** Centre of the detector. */
  detectorCentre: Vec3;
  /** Unit direction of the central ray (source → detector), the detector plane's normal. */
  beamDirection: Vec3;
  /** Unit direction on the detector of increasing pixel x (image right). */
  detectorRight: Vec3;
  /** Unit direction on the detector of decreasing pixel y (image up). */
  detectorUp: Vec3;
  /** Pixel where the ray from the source through `point` hits the detector. */
  project(point: Vec3): Pixel;
  /** The ray from the source through a pixel position on the detector. */
  unproject(pixel: Pixel): Ray;
}

const DEG = Math.PI / 180;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const normalise = (a: Vec3): Vec3 => scale(a, 1 / Math.sqrt(dot(a, a)));

/** Rotate v by the C-arm rotation: tilt about x first, then oblique about z. */
function rotate(v: Vec3, obliqueRad: number, tiltRad: number): Vec3 {
  // Tilt: about +x, so +y turns toward +z for positive (cranial) tilt.
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  const t = { x: v.x, y: v.y * ct - v.z * st, z: v.y * st + v.z * ct };
  // Oblique: about +z, so +y turns toward −x for positive (right) oblique.
  const co = Math.cos(obliqueRad);
  const so = Math.sin(obliqueRad);
  return { x: t.x * co - t.y * so, y: t.x * so + t.y * co, z: t.z };
}

/** Build the projection for a C-arm pose. */
export function createProjection(pose: CArmPose): Projection {
  const obl = pose.oblique * DEG;
  const tilt = pose.tilt * DEG;
  const isocentre: Vec3 = { x: -pose.tableLeftRight, y: -pose.tableHeight, z: -pose.tableHeadFoot };

  const beamDirection = rotate({ x: 0, y: 1, z: 0 }, obl, tilt);
  const detectorRight = rotate({ x: -1, y: 0, z: 0 }, obl, tilt);
  const detectorUp = rotate({ x: 0, y: 0, z: 1 }, obl, tilt);
  const source = add(isocentre, scale(beamDirection, -SOURCE_TO_ISOCENTRE_MM));
  const detectorCentre = add(source, scale(beamDirection, SOURCE_TO_DETECTOR_MM));

  const width = IMAGE_SIZE_PX;
  const height = IMAGE_SIZE_PX;
  const pixelSizeMm = DETECTOR_SIZE_MM / IMAGE_SIZE_PX;
  const cx = width / 2;
  const cy = height / 2;

  return {
    pose: { ...pose },
    width,
    height,
    pixelSizeMm,
    isocentre,
    source,
    detectorCentre,
    beamDirection,
    detectorRight,
    detectorUp,
    project(point) {
      const v = sub(point, source);
      const hit = add(source, scale(v, SOURCE_TO_DETECTOR_MM / dot(v, beamDirection)));
      const local = sub(hit, detectorCentre);
      return {
        x: cx + dot(local, detectorRight) / pixelSizeMm,
        y: cy - dot(local, detectorUp) / pixelSizeMm,
      };
    },
    unproject(pixel) {
      const onDetector = add(
        detectorCentre,
        add(scale(detectorRight, (pixel.x - cx) * pixelSizeMm), scale(detectorUp, (cy - pixel.y) * pixelSizeMm)),
      );
      return { origin: { ...source }, direction: normalise(sub(onDetector, source)) };
    },
  };
}
