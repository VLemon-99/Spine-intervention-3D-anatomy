// The three anatomy regions and cropping a converted volume down to one of them (SPEC F1.5).
// Works on volumes already in the standard layout (i → left, j → back, k → head).
import { isBone, LEVEL_IDS, TISSUE, type LevelCode } from '../../src/core/labels';
import type { Size3 } from './standardLayout';

export type RegionName = 'cervical' | 'thoracic' | 'lumbosacral';

export interface RegionDef {
  name: RegionName;
  title: string;
  /** Vertebral levels whose bone voxels the region is built around. */
  levels: readonly LevelCode[];
  /** Lumbosacral only: also keep the SI joints and the upper hip bones (iliac crests). */
  includesIlium: boolean;
}

export const REGIONS: Readonly<Record<RegionName, RegionDef>> = {
  cervical: { name: 'cervical', title: 'Cervical (C1–T1)', levels: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'T1'], includesIlium: false },
  thoracic: {
    name: 'thoracic',
    title: 'Thoracic (T1–L1)',
    levels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1'],
    includesIlium: false,
  },
  lumbosacral: {
    name: 'lumbosacral',
    title: 'Lumbosacral (L1–sacrum)',
    levels: ['L1', 'L2', 'L3', 'L4', 'L5', 'sacrum'],
    includesIlium: true,
  },
};

/** Extra room kept on every side of the region's bones (mm), limited by the volume's edges. */
export const CROP_MARGIN_MM = 10;
/**
 * Lumbosacral: ilium voxels within this distance of a sacrum voxel (measured
 * along each axis separately, i.e. a box of this half-width) are kept, so both
 * SI joints are inside the crop.
 */
export const SI_JOINT_DISTANCE_MM = 30;

export interface CropInput {
  size: Size3;
  spacing: Size3;
  origin: Size3;
  intensity: Uint8Array;
  labels: Uint8Array;
  levels: Uint8Array;
}

export interface CropOptions {
  marginMm?: number;
  siJointDistanceMm?: number;
}

export interface Box {
  lo: [number, number, number];
  /** Inclusive. */
  hi: [number, number, number];
}

export interface CropResult extends CropInput {
  box: Box;
  /** Region levels with no bone voxels in the scan. */
  missingLevels: LevelCode[];
}

/**
 * Crops intensity, labels and levels to the box around one region:
 * the bounding box of the region's bone voxels (lumbosacral: plus the ilium near
 * the sacrum and the hip bones from the bottom of the sacrum up to the iliac
 * crests), plus a margin, and stretched backwards (+y) to the skin at the back.
 * Every kept voxel keeps its patient position (origin is moved).
 */
export function cropToRegion(vol: CropInput, region: RegionName, options: CropOptions = {}): CropResult {
  const def = REGIONS[region];
  if (!def) throw new Error(`Unknown region "${region}"`);
  const { x: nx, y: ny, z: nz } = vol.size;
  const count = nx * ny * nz;
  for (const [name, arr] of [['intensity', vol.intensity], ['labels', vol.labels], ['levels', vol.levels]] as const) {
    if (arr.length !== count) throw new Error(`${name} has ${arr.length} voxels but the volume size needs ${count}`);
  }

  const wanted = new Set(def.levels.map((l) => LEVEL_IDS[l]));
  const seen = new Set<number>();
  const box = emptyBox();
  forEachVoxel(vol.size, (v, i, j, k) => {
    const level = vol.levels[v];
    if (wanted.has(level) && isBone(vol.labels[v])) {
      seen.add(level);
      grow(box, i, j, k);
    }
  });
  const missingLevels = def.levels.filter((l) => !seen.has(LEVEL_IDS[l]));
  if (seen.size === 0) {
    throw new Error(`Region "${region}": none of its levels (${def.levels.join(', ')}) are in the scan`);
  }

  if (def.includesIlium && seen.has(LEVEL_IDS.sacrum)) addIlium(vol, box, options.siJointDistanceMm ?? SI_JOINT_DISTANCE_MM);

  // Margin, limited by the volume's edges.
  const marginMm = options.marginMm ?? CROP_MARGIN_MM;
  const sp = [vol.spacing.x, vol.spacing.y, vol.spacing.z];
  const dims = [nx, ny, nz];
  const m = sp.map((s) => Math.ceil(marginMm / s - 1e-9));
  for (let a = 0; a < 3; a++) {
    box.lo[a] = Math.max(0, box.lo[a] - m[a]);
    box.hi[a] = Math.min(dims[a] - 1, box.hi[a] + m[a]);
  }

  // Reach the skin at the back: the furthest-back non-air voxel behind the box's columns.
  let back = -1;
  for (let k = box.lo[2]; k <= box.hi[2]; k++) {
    for (let i = box.lo[0]; i <= box.hi[0]; i++) {
      for (let j = ny - 1; j > back; j--) {
        if (vol.labels[i + nx * (j + ny * k)] !== TISSUE.air) {
          back = j;
          break;
        }
      }
    }
  }
  if (back >= 0) box.hi[1] = Math.max(box.hi[1], Math.min(ny - 1, back + m[1]));

  const out = cutBox(vol, box);
  return { ...out, box, missingLevels };
}

function addIlium(vol: CropInput, box: Box, distanceMm: number): void {
  const { x: nx, y: ny, z: nz } = vol.size;
  const sacrum = new Uint8Array(nx * ny * nz);
  let sacrumBottom = nz;
  forEachVoxel(vol.size, (v, _i, _j, k) => {
    if (vol.levels[v] === LEVEL_IDS.sacrum && isBone(vol.labels[v])) {
      sacrum[v] = 1;
      if (k < sacrumBottom) sacrumBottom = k;
    }
  });
  const r = [vol.spacing.x, vol.spacing.y, vol.spacing.z].map((s) => Math.floor(distanceMm / s + 1e-9));
  const near = dilateBox(sacrum, vol.size, r);
  forEachVoxel(vol.size, (v, i, j, k) => {
    if (vol.levels[v] !== LEVEL_IDS.ilium || !isBone(vol.labels[v])) return;
    // SI joints (ilium next to the sacrum), and the hip bones from the sacrum's bottom up to the crests.
    if (near[v] || k >= sacrumBottom) grow(box, i, j, k);
  });
}

/** Binary dilation by a box of half-widths r (voxels), done one axis at a time. */
function dilateBox(mask: Uint8Array, size: Size3, r: number[]): Uint8Array {
  const dims = [size.x, size.y, size.z];
  const strides = [1, size.x, size.x * size.y];
  let src = mask;
  for (let a = 0; a < 3; a++) {
    const dst = new Uint8Array(src.length);
    const len = dims[a];
    const stride = strides[a];
    const radius = r[a];
    for (let start = 0; start < src.length; start++) {
      // Only visit the first voxel of each line along axis a.
      if (Math.floor(start / stride) % len !== 0) continue;
      let lastOn = -Infinity;
      // Forward pass: distance to the last "on" voxel behind; backward pass: ahead.
      for (let t = 0; t < len; t++) {
        if (src[start + t * stride]) lastOn = t;
        if (t - lastOn <= radius) dst[start + t * stride] = 1;
      }
      let nextOn = Infinity;
      for (let t = len - 1; t >= 0; t--) {
        if (src[start + t * stride]) nextOn = t;
        if (nextOn - t <= radius) dst[start + t * stride] = 1;
      }
    }
    src = dst;
  }
  return src;
}

function cutBox(vol: CropInput, box: Box): CropInput {
  const { x: nx, y: ny } = vol.size;
  const size = { x: box.hi[0] - box.lo[0] + 1, y: box.hi[1] - box.lo[1] + 1, z: box.hi[2] - box.lo[2] + 1 };
  const count = size.x * size.y * size.z;
  const intensity = new Uint8Array(count);
  const labels = new Uint8Array(count);
  const levels = new Uint8Array(count);
  let n = 0;
  for (let k = box.lo[2]; k <= box.hi[2]; k++) {
    for (let j = box.lo[1]; j <= box.hi[1]; j++) {
      const row = nx * (j + ny * k);
      for (let i = box.lo[0]; i <= box.hi[0]; i++, n++) {
        intensity[n] = vol.intensity[row + i];
        labels[n] = vol.labels[row + i];
        levels[n] = vol.levels[row + i];
      }
    }
  }
  const origin = {
    x: vol.origin.x + box.lo[0] * vol.spacing.x,
    y: vol.origin.y + box.lo[1] * vol.spacing.y,
    z: vol.origin.z + box.lo[2] * vol.spacing.z,
  };
  return { size, spacing: { ...vol.spacing }, origin, intensity, labels, levels };
}

function emptyBox(): Box {
  return { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
}

function grow(box: Box, i: number, j: number, k: number): void {
  if (i < box.lo[0]) box.lo[0] = i;
  if (j < box.lo[1]) box.lo[1] = j;
  if (k < box.lo[2]) box.lo[2] = k;
  if (i > box.hi[0]) box.hi[0] = i;
  if (j > box.hi[1]) box.hi[1] = j;
  if (k > box.hi[2]) box.hi[2] = k;
}

function forEachVoxel(size: Size3, fn: (v: number, i: number, j: number, k: number) => void): void {
  let v = 0;
  for (let k = 0; k < size.z; k++) for (let j = 0; j < size.y; j++) for (let i = 0; i < size.x; i++) fn(v++, i, j, k);
}
