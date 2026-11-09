// Synthetic phantom: a small, generated, labelled block of "anatomy" that all
// automated tests use instead of the real CT (docs/SPEC.md F0.4).
//
// Conventions (docs/ARCHITECTURE.md): patient coordinates in mm,
// +x = patient's left, +y = posterior (toward the back), +z = toward the head.
// The patient is prone.
//
// Grid: 95 × 95 × 95 voxels of 1 mm, identity orientation, centred on the
// origin, so voxel centres sit on whole millimetres from −47 to +47.
// The body fills |x|, |y|, |z| ≤ 42 mm, leaving at least 3 voxel layers of air
// on every side (so the phantom never fills a typical C-arm field).
//
// Layout (all ranges inclusive, mm):
// - Body: elliptical cylinder x² + y² ≤ 42², |z| ≤ 42. Skin/fat is its outer
//   4 mm; muscle fills the rest unless another tissue is listed below.
// - Two vertebra-like blocks: the UPPER block (L4) lies entirely at z > 0 and
//   the LOWER block (L5) entirely at z < 0. Each block is made of boxes:
//     body       |x| ≤ 12, −22 ≤ y ≤ −2,  4 ≤ |z| ≤ 24
//     pedicles   9 ≤ |x| ≤ 13, −1 ≤ y ≤ 15, 12 ≤ |z| ≤ 22
//     lamina     |x| ≤ 12, 16 ≤ y ≤ 24,   5 ≤ |z| ≤ 24
//     articular  12 ≤ |x| ≤ 18, 14 ≤ y ≤ 22, 1 ≤ |z| ≤ 26 (upper top = its
//     pillars    superior articular process; lower top = L5's superior articular process)
//   Bone within 2 mm of a box face is cortical, deeper bone is cancellous.
// - Disc between the bodies: |x| ≤ 12, −22 ≤ y ≤ −2, |z| ≤ 3.
// - Facet joint spaces (one per side) between the two blocks' articular
//   pillars: 12 ≤ |x| ≤ 18, 14 ≤ y ≤ 22, z = 0.
// - Spinal canal behind the bodies, |z| ≤ 30:
//     epidural space   |x| ≤ 9, −2 ≤ y ≤ 15
//     thecal sac       cylinder round (x 0, y 6), radius 6
//     spinal cord      cylinder round (x 0, y 6), radius 3
//     ligamentum flavum between the laminae: |x| ≤ 9, 16 ≤ y ≤ 22, |z| ≤ 4
// - Nerve roots (one per side) exit through the foramina between the blocks:
//   cylinders along x, 5 ≤ |x| ≤ 26, round (y 5, z 0), radius 2.
// - Artery: cylinder along z round (x 8, y −28), radius 3.5, |z| ≤ 40.
// - Vein:   cylinder along z round (x −9, y −28), radius 4, |z| ≤ 40.
//
// Intensity: one 8-bit value per tissue (INTENSITY_BY_LABEL). Levels: the
// upper block's bone is L4, the lower block's L5. Landmarks: createPhantomLandmarks().

import { LEVEL_IDS, NO_LEVEL, TISSUE, isBone } from './labels';
import type { Landmarks, LevelLandmarks, Vec3, Volume } from './types';

/** Number of voxels along each axis. */
export const PHANTOM_SIZE = 95;
/** Voxel spacing in mm (same on every axis). */
export const PHANTOM_SPACING_MM = 1;

/** Documented test points (mm, patient coordinates). */
export const PHANTOM_TEST_POINTS = {
  /** Centres of the two vertebra blocks' bodies (upper = L4, lower = L5). */
  blockCentres: {
    upper: { x: 0, y: -12, z: 14 },
    lower: { x: 0, y: -12, z: -14 },
  },
  /** Centres of the foramina between the blocks (left = +x = patient's left). */
  foramenCentres: {
    left: { x: 13, y: 5, z: 0 },
    right: { x: -13, y: 5, z: 0 },
  },
  /** Midline line from behind the back (+y) to in front of the body (−y), between the laminae (interlaminar). */
  midlineLine: {
    start: { x: 0, y: 46, z: 0 },
    end: { x: 0, y: -46, z: 0 },
  },
} as const satisfies Record<string, Record<string, Vec3>>;

interface Box {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

/** Bone boxes of one block; zSign +1 builds the upper block, −1 the lower one. */
function blockBoxes(zSign: 1 | -1): Box[] {
  const z = (a: number, b: number): [number, number] => (zSign > 0 ? [a, b] : [-b, -a]);
  return [
    { x: [-12, 12], y: [-22, -2], z: z(4, 24) }, // body
    { x: [9, 13], y: [-1, 15], z: z(12, 22) }, // left pedicle
    { x: [-13, -9], y: [-1, 15], z: z(12, 22) }, // right pedicle
    { x: [-12, 12], y: [16, 24], z: z(5, 24) }, // lamina
    { x: [12, 18], y: [14, 22], z: z(1, 26) }, // left articular pillar
    { x: [-18, -12], y: [14, 22], z: z(1, 26) }, // right articular pillar
  ];
}

const BONE_BOXES: readonly Box[] = [...blockBoxes(1), ...blockBoxes(-1)];
const CORTEX_MM = 2;

const inRange = (v: number, [lo, hi]: [number, number]): boolean => v >= lo && v <= hi;
const inBox = (p: Vec3, b: Box): boolean => inRange(p.x, b.x) && inRange(p.y, b.y) && inRange(p.z, b.z);

/** Depth of p inside box b (distance to the nearest face). */
function depthInBox(p: Vec3, b: Box): number {
  return Math.min(p.x - b.x[0], b.x[1] - p.x, p.y - b.y[0], b.y[1] - p.y, p.z - b.z[0], b.z[1] - p.z);
}

/** Tissue label at a patient point (mm). Later checks win over earlier ones. */
function labelAtPoint(p: Vec3): number {
  const { x, y, z } = p;
  const ax = Math.abs(x);
  const az = Math.abs(z);

  // Bone (highest precedence).
  let boneDepth = -1;
  for (const box of BONE_BOXES) {
    if (inBox(p, box)) boneDepth = Math.max(boneDepth, depthInBox(p, box));
  }
  if (boneDepth >= 0) return boneDepth < CORTEX_MM ? TISSUE.corticalBone : TISSUE.cancellousBone;

  if (ax >= 12 && ax <= 18 && inRange(y, [14, 22]) && z === 0) return TISSUE.jointSpace;
  if (ax <= 12 && inRange(y, [-22, -2]) && az <= 3) return TISSUE.disc;

  const canalR2 = x * x + (y - 6) * (y - 6);
  if (az <= 30 && canalR2 <= 3 * 3) return TISSUE.spinalCord;
  if (az <= 30 && canalR2 <= 6 * 6) return TISSUE.thecalSac;
  if (ax >= 5 && ax <= 26 && (y - 5) * (y - 5) + z * z <= 2 * 2) return TISSUE.nerveRoot;
  if (ax <= 9 && inRange(y, [16, 22]) && az <= 4) return TISSUE.ligamentumFlavum;
  if (az <= 30 && ax <= 9 && inRange(y, [-2, 15])) return TISSUE.epiduralSpace;

  if (az <= 40 && (x - 8) * (x - 8) + (y + 28) * (y + 28) <= 3.5 * 3.5) return TISSUE.artery;
  if (az <= 40 && (x + 9) * (x + 9) + (y + 28) * (y + 28) <= 4 * 4) return TISSUE.vein;

  const r2 = x * x + y * y;
  if (r2 > 42 * 42 || az > 42) return TISSUE.air;
  if (r2 > 38 * 38 || az > 38) return TISSUE.skinFat;
  return TISSUE.muscle;
}

/**
 * 8-bit intensity per tissue label: denser tissue is higher. Bone is densest,
 * air is 0, soft tissues sit in between (roughly following CT density).
 */
const INTENSITY_BY_LABEL: Readonly<Record<number, number>> = {
  [TISSUE.air]: 0,
  [TISSUE.skinFat]: 70,
  [TISSUE.muscle]: 90,
  [TISSUE.corticalBone]: 230,
  [TISSUE.cancellousBone]: 170,
  [TISSUE.disc]: 95,
  [TISSUE.ligamentumFlavum]: 95,
  [TISSUE.epiduralSpace]: 75,
  [TISSUE.thecalSac]: 85,
  [TISSUE.spinalCord]: 90,
  [TISSUE.nerveRoot]: 90,
  [TISSUE.artery]: 100,
  [TISSUE.vein]: 95,
  [TISSUE.jointSpace]: 85,
};

/** Generate the phantom. Deterministic: every call gives an identical volume. */
export function createPhantom(): Volume {
  const n = PHANTOM_SIZE;
  const s = PHANTOM_SPACING_MM;
  const half = ((n - 1) / 2) * s;
  const origin: Vec3 = { x: -half, y: -half, z: -half };
  const labels = new Uint8Array(n * n * n);
  const intensity = new Uint8Array(n * n * n);
  const levels = new Uint8Array(n * n * n);
  for (let k = 0; k < n; k++) {
    const z = origin.z + k * s;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const index = i + n * (j + n * k);
        const label = labelAtPoint({ x: origin.x + i * s, y: origin.y + j * s, z });
        labels[index] = label;
        intensity[index] = INTENSITY_BY_LABEL[label] ?? 0;
        // Upper block (z > 0) is L4, lower block (z < 0) is L5; no other voxel has a level.
        levels[index] = isBone(label) ? (z > 0 ? LEVEL_IDS.L4 : LEVEL_IDS.L5) : NO_LEVEL;
      }
    }
  }
  return {
    region: 'phantom',
    size: { x: n, y: n, z: n },
    spacing: { x: s, y: s, z: s },
    origin,
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity,
    labels,
    levels,
  };
}

/** Landmarks of one block; zSign +1 = upper block (L4), −1 = lower block (L5). */
function blockLandmarks(zSign: 1 | -1): LevelLandmarks {
  const up = zSign > 0;
  return {
    level: up ? 'L4' : 'L5',
    bodyCentre: { ...PHANTOM_TEST_POINTS.blockCentres[up ? 'upper' : 'lower'] },
    // Centres of the pedicle boxes.
    pedicleCentre: {
      left: { x: 11, y: 7, z: 17 * zSign },
      right: { x: -11, y: 7, z: 17 * zSign },
    },
    // Top and bottom faces of the body box; normals point away from the body.
    superiorEndplate: { centre: { x: 0, y: -12, z: up ? 24 : -4 }, normal: { x: 0, y: 0, z: 1 } },
    inferiorEndplate: { centre: { x: 0, y: -12, z: up ? 4 : -24 }, normal: { x: 0, y: 0, z: -1 } },
    // Tops of the articular pillars.
    superiorArticularProcessTip: {
      left: { x: 15, y: 18, z: up ? 26 : -1 },
      right: { x: -15, y: 18, z: up ? 26 : -1 },
    },
    // The foramen between the blocks is listed under the level above it (L4).
    ...(up
      ? {
          foramenCentre: {
            left: { ...PHANTOM_TEST_POINTS.foramenCentres.left },
            right: { ...PHANTOM_TEST_POINTS.foramenCentres.right },
          },
        }
      : {}),
  };
}

/** The phantom's landmarks, in the same format as the real regions. Deterministic. */
export function createPhantomLandmarks(): Landmarks {
  return { region: 'phantom', levels: [blockLandmarks(1), blockLandmarks(-1)] };
}
