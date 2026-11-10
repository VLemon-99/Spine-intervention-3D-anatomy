// Soft-tissue modeller (SPEC F1.4): adds structures CT segmentations do not contain,
// as approximate shapes. Changes tissue labels only — never intensity, never bone.
// Works on volumes in the standard layout (i → left, j → back, k → head).
// The numbers live in tools/anatomy/soft-tissue-params.json (draft, for the owner to review).
import { readFileSync } from 'node:fs';
import { isBone, LEVEL_CODES, LEVEL_IDS, TISSUE } from '../../src/core/labels';
import type { Landmarks, Vec3, Volume } from '../../src/core/types';

export interface SoftTissueParams {
  status: string;
  reviewedByOwner: boolean;
  canal: { maxAreaMm2: number };
  ligamentumFlavum: { thicknessMm: number };
  thecalSac: { radiusMm: number; minCanalAreaMm2: number };
  nerveRoot: { radiusMm: number; lengthBeyondForamenMm: number; downwardAngleDeg: number };
  jointSpace: { maxWidthMm: number };
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
  positive(p.nerveRoot?.radiusMm, 'nerveRoot.radiusMm');
  positive(p.jointSpace?.maxWidthMm, 'jointSpace.maxWidthMm');
  positive(p.nerveRoot?.lengthBeyondForamenMm, 'nerveRoot.lengthBeyondForamenMm');
  if (typeof p.nerveRoot?.downwardAngleDeg !== 'number' || Math.abs(p.nerveRoot.downwardAngleDeg) >= 90) {
    throw new Error('soft-tissue-params.json: nerveRoot.downwardAngleDeg must be a number between -90 and 90');
  }
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
 * ligamentum flavum), nerve roots (needs the landmarks' foramen centres),
 * joint spaces (facet and SI; needs the level volume).
 */
export function modelSoftTissue<T extends ModelInput>(vol: T, landmarks?: Landmarks, params: SoftTissueParams = loadSoftTissueParams()): T {
  const labels = vol.labels.slice();
  modelThecalSac(vol, labels, params);
  modelCanal(vol, labels, params);
  if (landmarks) modelNerveRoots(vol, labels, landmarks, params);
  modelJointSpaces(vol, labels, params);
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

/** Labels a nerve root may replace: generic tissue and the modelled canal contents (never bone, sac or cord). */
const ROOT_MAY_REPLACE: ReadonlySet<number> = new Set([...GENERIC, TISSUE.nerveRoot]);

/**
 * Exiting nerve roots: for each foramen centre F (each side, each level), a
 * tube from the nearest thecal-sac voxel S through F, then on outward (away
 * from S in x) and downward for nerveRoot.lengthBeyondForamenMm.
 */
export function modelNerveRoots(vol: ModelInput, labels: Uint8Array, landmarks: Landmarks, params: SoftTissueParams): void {
  const sac = sacVoxels(vol, labels);
  if (sac.length === 0) return;
  const { radiusMm, lengthBeyondForamenMm, downwardAngleDeg } = params.nerveRoot;
  const down = (downwardAngleDeg * Math.PI) / 180;
  for (const level of landmarks.levels) {
    for (const side of ['left', 'right'] as const) {
      const f = level.foramenCentre?.[side];
      if (!f) continue;
      const s = nearestPoint(sac, f);
      const outward = Math.sign(f.x - s.x) || (side === 'left' ? 1 : -1);
      const end = {
        x: f.x + outward * lengthBeyondForamenMm * Math.cos(down),
        y: f.y,
        z: f.z - lengthBeyondForamenMm * Math.sin(down),
      };
      paintTube(vol, labels, [s, f, end], radiusMm, TISSUE.nerveRoot, ROOT_MAY_REPLACE);
    }
  }
}

function sacVoxels(vol: ModelInput, labels: Uint8Array): Vec3[] {
  const out: Vec3[] = [];
  const { x: nx, y: ny } = vol.size;
  for (let v = 0; v < labels.length; v++) {
    if (labels[v] !== TISSUE.thecalSac) continue;
    const i = v % nx;
    const j = Math.floor(v / nx) % ny;
    const k = Math.floor(v / (nx * ny));
    out.push(voxelPosition(vol, i, j, k));
  }
  return out;
}

function voxelPosition(vol: ModelInput, i: number, j: number, k: number): Vec3 {
  return { x: vol.origin.x + i * vol.spacing.x, y: vol.origin.y + j * vol.spacing.y, z: vol.origin.z + k * vol.spacing.z };
}

function nearestPoint(points: readonly Vec3[], p: Vec3): Vec3 {
  let best = points[0];
  let bestD = Infinity;
  for (const q of points) {
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Distance from p to the segment a–b (mm). */
function distToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len2 = ab.x ** 2 + ab.y ** 2 + ab.z ** 2;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * ab.x), p.y - (a.y + t * ab.y), p.z - (a.z + t * ab.z));
}

/** Labels every allowed voxel within `radius` mm of the polyline. */
export function paintTube(
  vol: ModelInput,
  labels: Uint8Array,
  path: readonly Vec3[],
  radius: number,
  label: number,
  mayReplace: ReadonlySet<number>,
): void {
  const { x: nx, y: ny, z: nz } = vol.size;
  const toIndex = (value: number, o: number, s: number, n: number, round: (x: number) => number) =>
    Math.max(0, Math.min(n - 1, round((value - o) / s)));
  for (let n = 0; n + 1 < path.length; n++) {
    const a = path[n];
    const b = path[n + 1];
    const lo = [Math.min(a.x, b.x) - radius, Math.min(a.y, b.y) - radius, Math.min(a.z, b.z) - radius];
    const hi = [Math.max(a.x, b.x) + radius, Math.max(a.y, b.y) + radius, Math.max(a.z, b.z) + radius];
    const i0 = toIndex(lo[0], vol.origin.x, vol.spacing.x, nx, Math.floor);
    const i1 = toIndex(hi[0], vol.origin.x, vol.spacing.x, nx, Math.ceil);
    const j0 = toIndex(lo[1], vol.origin.y, vol.spacing.y, ny, Math.floor);
    const j1 = toIndex(hi[1], vol.origin.y, vol.spacing.y, ny, Math.ceil);
    const k0 = toIndex(lo[2], vol.origin.z, vol.spacing.z, nz, Math.floor);
    const k1 = toIndex(hi[2], vol.origin.z, vol.spacing.z, nz, Math.ceil);
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const v = i + nx * (j + ny * k);
          if (!mayReplace.has(labels[v])) continue;
          if (distToSegment(voxelPosition(vol, i, j, k), a, b) <= radius) labels[v] = label;
        }
  }
}

/** Labels a joint space may replace. */
const JOINT_MAY_REPLACE: ReadonlySet<number> = new Set([TISSUE.air, TISSUE.skinFat, TISSUE.muscle, TISSUE.jointSpace]);

/** The 13 directions that, with their opposites, reach all 26 neighbours. */
const DIRECTIONS: readonly [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let dk = -1; dk <= 1; dk++)
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const first = dk !== 0 ? dk : dj !== 0 ? dj : di;
        if (first > 0) out.push([di, dj, dk]);
      }
  return out;
})();

type JointKind = 'facet' | 'si';

/** Which joint two bone level ids make, if any. */
function jointKind(a: number, b: number): JointKind | undefined {
  if (a === 0 || b === 0 || a === b) return undefined;
  const sacrum = LEVEL_IDS.sacrum;
  const ilium = LEVEL_IDS.ilium;
  if ((a === sacrum && b === ilium) || (a === ilium && b === sacrum)) return 'si';
  if (a === ilium || b === ilium) return undefined;
  // Neighbouring vertebral levels (L5 and sacrum included): ids follow LEVEL_CODES order.
  return Math.abs(a - b) === 1 && Math.max(a, b) <= LEVEL_CODES.indexOf('sacrum') + 1 ? 'facet' : undefined;
}

/**
 * Joint spaces: from every bone voxel, walk each of the 13 directions through
 * non-bone voxels; if bone of a level that forms a joint with it is reached
 * within jointSpace.maxWidthMm, the voxels walked over become joint space
 * (only voxels of generic tissue; a walk through anything else is skipped).
 * Facet joints count only behind the front edge of the canal (j greater than
 * the canal's front in that slice), so disc spaces never count; with no canal
 * in the volume there are no facet joints.
 */
export function modelJointSpaces(vol: ModelInput, labels: Uint8Array, params: SoftTissueParams): void {
  const levels = vol.levels;
  if (!levels) return;
  const { x: nx, y: ny, z: nz } = vol.size;
  const canalFront = canalFrontBySlice(vol, labels);
  const sp = [vol.spacing.x, vol.spacing.y, vol.spacing.z];
  const between: number[] = [];
  const mark = new Uint8Array(labels.length);
  for (let v = 0; v < labels.length; v++) {
    if (!isBone(labels[v]) || levels[v] === 0) continue;
    const i0 = v % nx;
    const j0 = Math.floor(v / nx) % ny;
    const k0 = Math.floor(v / (nx * ny));
    for (const [di, dj, dk] of DIRECTIONS) {
      const step = Math.hypot(di * sp[0], dj * sp[1], dk * sp[2]);
      const maxSteps = Math.floor(params.jointSpace.maxWidthMm / step + 1e-9);
      between.length = 0;
      let i = i0;
      let j = j0;
      let k = k0;
      for (let n = 1; n <= maxSteps + 1; n++) {
        i += di;
        j += dj;
        k += dk;
        if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) break;
        const w = i + nx * (j + ny * k);
        if (isBone(labels[w])) {
          if (between.length === 0) break; // touching bone, no gap
          const kind = jointKind(levels[v], levels[w]);
          if (!kind) break;
          if (kind === 'facet' && !between.every((u) => behindCanalFront(u, nx, ny, canalFront))) break;
          for (const u of between) mark[u] = 1;
          break;
        }
        if (!JOINT_MAY_REPLACE.has(labels[w]) || n > maxSteps) break;
        between.push(w);
      }
    }
  }
  for (let v = 0; v < labels.length; v++) if (mark[v]) labels[v] = TISSUE.jointSpace;
}

function behindCanalFront(v: number, nx: number, ny: number, front: Int32Array | null): boolean {
  if (!front) return false;
  const j = Math.floor(v / nx) % ny;
  const k = Math.floor(v / (nx * ny));
  return j > front[k];
}

/** Per slice: the smallest j of canal voxels (sac, cord, epidural), filled from the nearest slice that has one. */
function canalFrontBySlice(vol: ModelInput, labels: Uint8Array): Int32Array | null {
  const { x: nx, y: ny, z: nz } = vol.size;
  const front = new Int32Array(nz).fill(-1);
  for (let k = 0; k < nz; k++) {
    outer: for (let j = 0; j < ny; j++) {
      const row = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) {
        const l = labels[row + i];
        if (l === TISSUE.thecalSac || l === TISSUE.spinalCord || l === TISSUE.epiduralSpace) {
          front[k] = j;
          break outer;
        }
      }
    }
  }
  const known = [...front.keys()].filter((k) => front[k] >= 0);
  if (known.length === 0) return null;
  for (let k = 0; k < nz; k++) {
    if (front[k] >= 0) continue;
    let best = known[0];
    for (const c of known) if (Math.abs(c - k) < Math.abs(best - k)) best = c;
    front[k] = front[best];
  }
  return front;
}
