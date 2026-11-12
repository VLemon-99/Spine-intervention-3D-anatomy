// Test helper: a small generated "pelvis fixture" — an L5 block shaped like the
// phantom's lower block, a sacrum below it and a hip bone ('ilium') on each side
// of the sacrum, separated from it by a narrow gap. Standard layout, 1 mm voxels.
// Its true landmark positions are exported (used by F1-S11, F1-S23 and F1-S15).
//
// Boxes (mm, inclusive; |x| means one box per side, left = +x):
//   L5 body          |x| ≤ 12, −22 ≤ y ≤ −2, 0 ≤ z ≤ 20
//   L5 pedicles      9 ≤ |x| ≤ 13, −1 ≤ y ≤ 15, 2 ≤ z ≤ 12
//   L5 lamina        |x| ≤ 12, 16 ≤ y ≤ 24, 1 ≤ z ≤ 20
//   L5 pillars       12 ≤ |x| ≤ 18, 14 ≤ y ≤ 22, −2 ≤ z ≤ 23
//   sacrum S1 body   |x| ≤ 14, −24 ≤ y ≤ −2, −40 ≤ z ≤ −6   (disc gap z −5…−1)
//   sacrum pedicles  9 ≤ |x| ≤ 14, −1 ≤ y ≤ 15, −40 ≤ z ≤ −14
//   sacrum lamina    |x| ≤ 12, 16 ≤ y ≤ 24, −40 ≤ z ≤ −12
//   S1 SAP pillars   12 ≤ |x| ≤ 18, 14 ≤ y ≤ 22, −40 ≤ z ≤ −4 (L5–S1 facet gap at z −3)
//   sacral ala       14 ≤ |x| ≤ 30, −10 ≤ y ≤ 13, −40 ≤ z ≤ −10
//   ilium            33 ≤ |x| ≤ 45, −10 ≤ y ≤ 13, −60 ≤ z ≤ −10 (SI gap: |x| 31…32)
//   iliac wing       35 ≤ |x| ≤ 45, −6 ≤ y ≤ 6, −9 ≤ z ≤ 15
//   crest peak       |x| 39…41, −1 ≤ y ≤ 1, up to z 20 (left) / 18 (right)
//   thecal sac       cylinder round (x 0, y 6), radius 6, all z
import { LEVEL_IDS, TISSUE, type LevelCode } from '../../src/core/labels';
import type { Vec3, Volume } from '../../src/core/types';

const X: [number, number] = [-60, 60];
const Y: [number, number] = [-40, 40];
const Z: [number, number] = [-70, 40];

type Range = [number, number];
interface Box {
  x: Range;
  y: Range;
  z: Range;
  level: LevelCode;
}

const both = (lo: number, hi: number): Range[] => [
  [lo, hi],
  [-hi, -lo],
];

function boxes(crestTop: { left: number; right: number }): Box[] {
  const out: Box[] = [
    { x: [-12, 12], y: [-22, -2], z: [0, 20], level: 'L5' },
    { x: [-12, 12], y: [16, 24], z: [1, 20], level: 'L5' },
    { x: [-14, 14], y: [-24, -2], z: [-40, -6], level: 'sacrum' },
    { x: [-12, 12], y: [16, 24], z: [-40, -12], level: 'sacrum' },
  ];
  for (const x of both(9, 13)) out.push({ x, y: [-1, 15], z: [2, 12], level: 'L5' });
  for (const x of both(12, 18)) out.push({ x, y: [14, 22], z: [-2, 23], level: 'L5' });
  for (const x of both(9, 14)) out.push({ x, y: [-1, 15], z: [-40, -14], level: 'sacrum' });
  for (const x of both(12, 18)) out.push({ x, y: [14, 22], z: [-40, -4], level: 'sacrum' });
  for (const x of both(14, 30)) out.push({ x, y: [-10, 13], z: [-40, -10], level: 'sacrum' });
  for (const x of both(33, 45)) out.push({ x, y: [-10, 13], z: [-60, -10], level: 'ilium' });
  for (const x of both(35, 45)) out.push({ x, y: [-6, 6], z: [-9, 15], level: 'ilium' });
  out.push({ x: [39, 41], y: [-1, 1], z: [16, crestTop.left], level: 'ilium' });
  out.push({ x: [-41, -39], y: [-1, 1], z: [16, crestTop.right], level: 'ilium' });
  return out;
}

export interface PelvisFixtureOptions {
  /** Make the volume end at this z (mm) at the top, e.g. to cut off a crest. */
  topZ?: number;
}

export function createPelvisFixture(options: PelvisFixtureOptions = {}): Volume {
  const top = options.topZ ?? Z[1];
  const size = { x: X[1] - X[0] + 1, y: Y[1] - Y[0] + 1, z: top - Z[0] + 1 };
  const count = size.x * size.y * size.z;
  const labels = new Uint8Array(count);
  const levels = new Uint8Array(count);
  const intensity = new Uint8Array(count);
  const bone = boxes({ left: 20, right: 18 });
  let v = 0;
  for (let z = Z[0]; z <= top; z++)
    for (let y = Y[0]; y <= Y[1]; y++)
      for (let x = X[0]; x <= X[1]; x++, v++) {
        const b = bone.find((bx) => x >= bx.x[0] && x <= bx.x[1] && y >= bx.y[0] && y <= bx.y[1] && z >= bx.z[0] && z <= bx.z[1]);
        if (b) {
          labels[v] = TISSUE.cancellousBone;
          levels[v] = LEVEL_IDS[b.level];
          intensity[v] = 170;
        } else if (x * x + (y - 6) * (y - 6) <= 36) {
          labels[v] = TISSUE.thecalSac;
          intensity[v] = 85;
        }
      }
  return {
    region: 'pelvis-fixture',
    size,
    spacing: { x: 1, y: 1, z: 1 },
    origin: { x: X[0], y: Y[0], z: Z[0] },
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

/** True landmark positions of the pelvis fixture (mm). */
export const PELVIS_TRUTH = {
  l5: {
    bodyCentre: { x: 0, y: -12, z: 10 },
    pedicleCentre: { left: { x: 11, y: 7, z: 7 }, right: { x: -11, y: 7, z: 7 } },
    /** L5–S1 foramen: between L5's pedicle (bottom z 2) and the sacrum's top beside the canal (z −14). */
    foramenCentre: { left: { x: 11, y: 7, z: -6 }, right: { x: -11, y: 7, z: -6 } },
  },
  /** Top of the sacrum beside the canal, under each L5 pedicle. */
  sacrumTopBesideCanalZ: -14,
  sacrum: {
    superiorEndplate: { centre: { x: 0, y: -13, z: -6 }, normal: { x: 0, y: 0, z: 1 } },
    superiorArticularProcessTip: { left: { x: 15, y: 18, z: -4 }, right: { x: -15, y: 18, z: -4 } },
  },
  iliacCrest: { left: { x: 40, y: 0, z: 20 }, right: { x: -40, y: 0, z: 18 } },
  /** SI joint gap between sacral ala (|x| ≤ 30) and ilium (|x| ≥ 33): |x| 31…32, −10 ≤ y ≤ 13, −40 ≤ z ≤ −10. */
  siGap: { absX: [31, 32] as Range, y: [-10, 13] as Range, z: [-40, -10] as Range },
  /** L5–S1 facet joint gap: 12 ≤ |x| ≤ 18, 14 ≤ y ≤ 22, z = −3. */
  l5s1FacetGapZ: -3,
} as const;

export type PelvisPoint = Vec3;
