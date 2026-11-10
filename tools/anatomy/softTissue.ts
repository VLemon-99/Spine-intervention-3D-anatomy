// Soft-tissue modeller (SPEC F1.4): adds structures CT segmentations do not contain,
// as approximate shapes. Changes tissue labels only — never intensity, never bone.
// Works on volumes in the standard layout (i → left, j → back, k → head).
// The numbers live in tools/anatomy/soft-tissue-params.json (draft, for the owner to review).
import { readFileSync } from 'node:fs';
import { isBone, TISSUE } from '../../src/core/labels';
import type { Landmarks, Volume } from '../../src/core/types';

export interface SoftTissueParams {
  status: string;
  reviewedByOwner: boolean;
  canal: { maxAreaMm2: number };
  ligamentumFlavum: { thicknessMm: number };
  thecalSac: { radiusMm: number; minCanalAreaMm2: number };
}

const PARAMS_URL = new URL('./soft-tissue-params.json', import.meta.url);

export function loadSoftTissueParams(): SoftTissueParams {
  const p = JSON.parse(readFileSync(PARAMS_URL, 'utf8')) as SoftTissueParams;
  const positive = (v: unknown, name: string) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new Error(`tools/anatomy/soft-tissue-params.json: ${name} must be a positive number`);
    }
  };
  positive(p.canal?.maxAreaMm2, 'canal.maxAreaMm2');
  positive(p.ligamentumFlavum?.thicknessMm, 'ligamentumFlavum.thicknessMm');
  positive(p.thecalSac?.radiusMm, 'thecalSac.radiusMm');
  positive(p.thecalSac?.minCanalAreaMm2, 'thecalSac.minCanalAreaMm2');
  if (typeof p.reviewedByOwner !== 'boolean') throw new Error('soft-tissue-params.json: reviewedByOwner must be true or false');
  return p;
}

export type ModelInput = Pick<Volume, 'size' | 'spacing' | 'origin' | 'labels' | 'intensity'> & Partial<Pick<Volume, 'levels' | 'region' | 'orientation'>>;

/** Labels the modeller may overwrite with epidural space or ligamentum flavum (generic tissue only). */
const GENERIC: ReadonlySet<number> = new Set([TISSUE.air, TISSUE.skinFat, TISSUE.muscle, TISSUE.epiduralSpace, TISSUE.ligamentumFlavum]);
const SAC: ReadonlySet<number> = new Set([TISSUE.thecalSac, TISSUE.spinalCord]);

/**
 * Runs every modelling step and returns a copy of the volume with new labels
 * (the intensity array is the same values, untouched). Steps, in order:
 * thecal sac (only if the volume has none), canal (epidural space +
 * ligamentum flavum).
 */
export function modelSoftTissue<T extends ModelInput>(vol: T, _landmarks?: Landmarks, params: SoftTissueParams = loadSoftTissueParams()): T {
  const labels = vol.labels.slice();
  modelThecalSac(vol, labels, params);
  modelCanal(vol, labels, params);
  return { ...vol, labels };
}

/**
 * Epidural space and ligamentum flavum. Per axial slice (fixed k): the bony
 * canal is the 4-connected non-bone region grown from the thecal sac / cord
 * voxels. If it reaches the slice edge or is larger than canal.maxAreaMm2,
 * the ring is open there and the canal of the nearest closed slice (both, if
 * equally near) is used instead. Generic voxels in the canal become epidural
 * space. In open slices between two closed ones, a layer behind the canal
 * (+y) becomes ligamentum flavum where there is no bone.
 */
export function modelCanal(vol: ModelInput, labels: Uint8Array, params: SoftTissueParams): void {
  const { x: nx, y: ny, z: nz } = vol.size;
  const sliceSize = nx * ny;
  const maxVoxels = params.canal.maxAreaMm2 / (vol.spacing.x * vol.spacing.y);

  // Grow the canal in each slice that has sac voxels.
  const canal: (Uint8Array | null)[] = new Array(nz).fill(null);
  const hasSac: boolean[] = new Array(nz).fill(false);
  for (let k = 0; k < nz; k++) {
    const base = k * sliceSize;
    const seeds: number[] = [];
    for (let p = 0; p < sliceSize; p++) if (SAC.has(labels[base + p])) seeds.push(p);
    if (seeds.length === 0) continue;
    hasSac[k] = true;
    canal[k] = growSlice(labels, base, nx, ny, seeds, maxVoxels);
  }

  // Carry the outline across open slices.
  const closed = canal.map((c, k) => (c ? k : -1)).filter((k) => k >= 0);
  if (closed.length === 0) return;
  const used: (Uint8Array | null)[] = new Array(nz).fill(null);
  const between: boolean[] = new Array(nz).fill(false);
  for (let k = 0; k < nz; k++) {
    if (!hasSac[k]) continue;
    if (canal[k]) {
      used[k] = canal[k];
      continue;
    }
    let below = -1;
    let above = -1;
    for (const c of closed) {
      if (c < k) below = c;
      else if (above < 0) above = c;
    }
    between[k] = below >= 0 && above >= 0;
    const dBelow = below >= 0 ? k - below : Infinity;
    const dAbove = above >= 0 ? above - k : Infinity;
    if (dBelow === dAbove) {
      const m = new Uint8Array(sliceSize);
      for (let p = 0; p < sliceSize; p++) m[p] = canal[below]![p] | canal[above]![p];
      used[k] = m;
    } else used[k] = canal[dBelow < dAbove ? below : above];
  }

  const lfVoxels = Math.max(1, Math.round(params.ligamentumFlavum.thicknessMm / vol.spacing.y));
  for (let k = 0; k < nz; k++) {
    const m = used[k];
    if (!m) continue;
    const base = k * sliceSize;
    for (let p = 0; p < sliceSize; p++) {
      if (m[p] && GENERIC.has(labels[base + p]) && labels[base + p] !== TISSUE.ligamentumFlavum) labels[base + p] = TISSUE.epiduralSpace;
    }
    if (!between[k]) continue;
    // Ligamentum flavum behind the canal's back edge, column by column (fixed i).
    for (let i = 0; i < nx; i++) {
      let back = -1;
      for (let j = ny - 1; j >= 0; j--) {
        if (m[i + nx * j]) {
          back = j;
          break;
        }
      }
      if (back < 0) continue;
      for (let j = back + 1; j <= Math.min(ny - 1, back + lfVoxels); j++) {
        const v = base + i + nx * j;
        if (isBone(labels[v])) break;
        if (GENERIC.has(labels[v]) && labels[v] !== TISSUE.epiduralSpace) labels[v] = TISSUE.ligamentumFlavum;
      }
    }
  }
}

/** 4-connected non-bone region from the seeds, or null if it is open (reaches the edge or grows too large). */
function growSlice(labels: Uint8Array, base: number, nx: number, ny: number, seeds: number[], maxVoxels: number): Uint8Array | null {
  const mask = new Uint8Array(nx * ny);
  const stack = [...seeds];
  for (const s of seeds) mask[s] = 1;
  let count = seeds.length;
  while (stack.length) {
    const p = stack.pop()!;
    const i = p % nx;
    const j = (p - i) / nx;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) return null;
    for (const q of [p - 1, p + 1, p - nx, p + nx]) {
      if (mask[q] || isBone(labels[base + q])) continue;
      mask[q] = 1;
      if (++count > maxVoxels) return null;
      stack.push(q);
    }
  }
  return mask;
}

/**
 * If the volume has no thecal sac voxels at all, adds one: a tube down the
 * middle of the bony canal. Per axial slice the canal is the largest
 * bone-enclosed non-bone area (not touching the slice edge) between
 * thecalSac.minCanalAreaMm2 and canal.maxAreaMm2. Slices within the bones'
 * height that have none take the outline of the nearest slice that has one,
 * with the tube's centre interpolated between the slices above and below.
 * A volume that already has a thecal sac is left exactly as it is.
 */
export function modelThecalSac(vol: ModelInput, labels: Uint8Array, params: SoftTissueParams): void {
  if (labels.includes(TISSUE.thecalSac)) return;
  const { x: nx, y: ny, z: nz } = vol.size;
  const sliceSize = nx * ny;
  const voxelArea = vol.spacing.x * vol.spacing.y;
  const maxVoxels = params.canal.maxAreaMm2 / voxelArea;
  const minVoxels = params.thecalSac.minCanalAreaMm2 / voxelArea;

  const holes: (Uint8Array | null)[] = new Array(nz).fill(null);
  const centre: ({ i: number; j: number } | null)[] = new Array(nz).fill(null);
  let kBoneMin = Infinity;
  let kBoneMax = -Infinity;
  for (let k = 0; k < nz; k++) {
    const base = k * sliceSize;
    let anyBone = false;
    for (let p = 0; p < sliceSize && !anyBone; p++) anyBone = isBone(labels[base + p]);
    if (!anyBone) continue;
    kBoneMin = Math.min(kBoneMin, k);
    kBoneMax = Math.max(kBoneMax, k);
    const hole = largestHole(labels, base, nx, ny, minVoxels, maxVoxels);
    if (!hole) continue;
    holes[k] = hole.mask;
    centre[k] = hole.centre;
  }
  const found = holes.map((h, k) => (h ? k : -1)).filter((k) => k >= 0);
  if (found.length === 0) return;

  const r = params.thecalSac.radiusMm;
  for (let k = kBoneMin; k <= kBoneMax; k++) {
    let mask = holes[k];
    let c = centre[k];
    if (!mask) {
      let below = -1;
      let above = -1;
      for (const f of found) {
        if (f < k) below = f;
        else if (above < 0) above = f;
      }
      const near = below < 0 ? above : above < 0 ? below : k - below <= above - k ? below : above;
      mask = holes[near]!;
      if (below >= 0 && above >= 0) {
        const t = (k - below) / (above - below);
        c = {
          i: centre[below]!.i + t * (centre[above]!.i - centre[below]!.i),
          j: centre[below]!.j + t * (centre[above]!.j - centre[below]!.j),
        };
      } else c = centre[near];
    }
    const base = k * sliceSize;
    for (let p = 0; p < sliceSize; p++) {
      if (!mask[p]) continue;
      const i = p % nx;
      const j = (p - i) / nx;
      const d = Math.hypot((i - c!.i) * vol.spacing.x, (j - c!.j) * vol.spacing.y);
      if (d <= r && GENERIC.has(labels[base + p])) labels[base + p] = TISSUE.thecalSac;
    }
  }
}

/** Largest 4-connected non-bone area of a slice that is enclosed by bone and within the size limits. */
function largestHole(
  labels: Uint8Array,
  base: number,
  nx: number,
  ny: number,
  minVoxels: number,
  maxVoxels: number,
): { mask: Uint8Array; centre: { i: number; j: number } } | null {
  const seen = new Uint8Array(nx * ny);
  let best: number[] | null = null;
  for (let start = 0; start < nx * ny; start++) {
    if (seen[start] || isBone(labels[base + start])) continue;
    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;
    let open = false;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const i = p % nx;
      const j = (p - i) / nx;
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) {
        open = true;
        continue;
      }
      for (const q of [p - 1, p + 1, p - nx, p + nx]) {
        if (seen[q] || isBone(labels[base + q])) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (open || region.length < minVoxels || region.length > maxVoxels) continue;
    if (!best || region.length > best.length) best = region;
  }
  if (!best) return null;
  const mask = new Uint8Array(nx * ny);
  let si = 0;
  let sj = 0;
  for (const p of best) {
    mask[p] = 1;
    si += p % nx;
    sj += Math.floor(p / nx);
  }
  return { mask, centre: { i: si / best.length, j: sj / best.length } };
}
