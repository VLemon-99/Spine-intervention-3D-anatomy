// Landmarks computed from the label and level volumes (SPEC F1.5).
// Works on volumes in the standard layout (identity orientation): voxel (i, j, k)
// sits at origin + (i, j, k) × spacing in patient mm (+x left, +y back, +z head).
// Results are approximations for the owner to review on real anatomy.
import { isBone, LEVEL_CODES, LEVEL_IDS, TISSUE, type LevelCode } from '../../src/core/labels';
import type { Endplate, LevelLandmarks, Vec3, Volume } from '../../src/core/types';

/** Levels with a typical vertebral body (C1 and C2 are left out for now; sacrum and ilium have their own landmarks). */
export const TYPICAL_LEVELS: readonly LevelCode[] = LEVEL_CODES.filter(
  (l) => l !== 'C1' && l !== 'C2' && l !== 'sacrum' && l !== 'ilium',
);

export type BodyLandmarks = Pick<LevelLandmarks, 'level' | 'bodyCentre' | 'superiorEndplate' | 'inferiorEndplate'>;

/** Labels that mark the spinal canal at this stage (before the soft-tissue modeller runs). */
const CANAL_LABELS: ReadonlySet<number> = new Set([TISSUE.thecalSac, TISSUE.spinalCord]);

/** When a level has no canal voxels beside it, its body is taken as the front part of its bone (this share of its depth). */
export const BODY_FRONT_SHARE_WITHOUT_CANAL = 0.4;

/** Endplate faces are fitted on body columns at least this share of the tallest column's height (skips rounded rims and stray bits). */
const ENDPLATE_COLUMN_SHARE = 0.75;

type VolumeGrid = Pick<Volume, 'size' | 'spacing' | 'origin' | 'labels' | 'levels'>;

/** Voxel indices of each level's bone voxels, in index order. */
export function boneVoxelsByLevel(vol: VolumeGrid): Map<number, number[]> {
  const byLevel = new Map<number, number[]>();
  const { labels, levels } = vol;
  if (!levels) return byLevel;
  for (let v = 0; v < labels.length; v++) {
    const level = levels[v];
    if (level === 0 || !isBone(labels[v])) continue;
    let list = byLevel.get(level);
    if (!list) byLevel.set(level, (list = []));
    list.push(v);
  }
  return byLevel;
}

/** The vertebral body's voxels for one level: its bone in front of (−y) the spinal canal. */
export function bodyVoxels(vol: VolumeGrid, bone: readonly number[]): number[] {
  const { x: nx, y: ny } = vol.size;
  const nxy = nx * ny;
  let kMin = Infinity;
  let kMax = -Infinity;
  let jMin = Infinity;
  let jMax = -Infinity;
  for (const v of bone) {
    const k = Math.floor(v / nxy);
    const j = Math.floor(v / nx) % ny;
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
    if (j < jMin) jMin = j;
    if (j > jMax) jMax = j;
  }
  // Front edge of the canal beside this level.
  let canalFront = Infinity;
  for (let k = kMin; k <= kMax; k++) {
    for (let j = 0; j < ny && j < canalFront; j++) {
      const row = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) {
        if (CANAL_LABELS.has(vol.labels[row + i])) {
          canalFront = j;
          break;
        }
      }
    }
  }
  const limit = Number.isFinite(canalFront) ? canalFront : jMin + BODY_FRONT_SHARE_WITHOUT_CANAL * (jMax - jMin + 1);
  return bone.filter((v) => Math.floor(v / nx) % ny < limit);
}

/** Body centre and endplates for every typical level present (C3 … L5), from head to foot. */
export function findBodyLandmarks(vol: VolumeGrid): BodyLandmarks[] {
  const byLevel = boneVoxelsByLevel(vol);
  const out: BodyLandmarks[] = [];
  for (const level of TYPICAL_LEVELS) {
    const bone = byLevel.get(LEVEL_IDS[level]);
    if (!bone || bone.length === 0) continue;
    const body = bodyVoxels(vol, bone);
    if (body.length === 0) continue;
    const ends = fitEndplates(vol, body);
    if (!ends) continue;
    out.push({ level, bodyCentre: centreInside(vol, body), ...ends });
  }
  return out;
}

function position(vol: VolumeGrid, i: number, j: number, k: number): Vec3 {
  return {
    x: vol.origin.x + i * vol.spacing.x,
    y: vol.origin.y + j * vol.spacing.y,
    z: vol.origin.z + k * vol.spacing.z,
  };
}

function ijk(vol: VolumeGrid, v: number): [number, number, number] {
  const { x: nx, y: ny } = vol.size;
  return [v % nx, Math.floor(v / nx) % ny, Math.floor(v / (nx * ny))];
}

/** Mean position of the voxels; if that point is not one of them, the nearest of them. */
export function centreInside(vol: VolumeGrid, voxels: readonly number[]): Vec3 {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const v of voxels) {
    const [i, j, k] = ijk(vol, v);
    sx += i;
    sy += j;
    sz += k;
  }
  const n = voxels.length;
  const mean = [sx / n, sy / n, sz / n];
  const set = new Set(voxels);
  const [ri, rj, rk] = mean.map(Math.round);
  const { x: nx, y: ny } = vol.size;
  if (set.has(ri + nx * (rj + ny * rk))) return position(vol, mean[0], mean[1], mean[2]);
  let best = voxels[0];
  let bestD = Infinity;
  for (const v of voxels) {
    const [i, j, k] = ijk(vol, v);
    const d =
      ((i - mean[0]) * vol.spacing.x) ** 2 + ((j - mean[1]) * vol.spacing.y) ** 2 + ((k - mean[2]) * vol.spacing.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  const [i, j, k] = ijk(vol, best);
  return position(vol, i, j, k);
}

/**
 * Top and bottom faces of the body: for each (i, j) column of body voxels, its
 * highest and lowest voxel; a plane is fitted through each set (least squares,
 * z = a·x + b·y + c in mm). Centre = the plane at the columns' mean (x, y);
 * normal points away from the body (up for the top face, down for the bottom).
 */
function fitEndplates(vol: VolumeGrid, body: readonly number[]): Pick<BodyLandmarks, 'superiorEndplate' | 'inferiorEndplate'> | null {
  const cols = new Map<number, { top: number; bottom: number; i: number; j: number }>();
  for (const v of body) {
    const [i, j, k] = ijk(vol, v);
    const key = i + vol.size.x * j;
    const c = cols.get(key);
    if (!c) cols.set(key, { top: k, bottom: k, i, j });
    else {
      if (k > c.top) c.top = k;
      if (k < c.bottom) c.bottom = k;
    }
  }
  const all = [...cols.values()];
  const tallest = Math.max(...all.map((c) => c.top - c.bottom + 1));
  const used = all.filter((c) => c.top - c.bottom + 1 >= ENDPLATE_COLUMN_SHARE * tallest);
  if (used.length < 3) return null;
  const pts = (pick: 'top' | 'bottom') => used.map((c) => position(vol, c.i, c.j, c[pick]));
  const superior = fitPlane(pts('top'), 1);
  const inferior = fitPlane(pts('bottom'), -1);
  return superior && inferior ? { superiorEndplate: superior, inferiorEndplate: inferior } : null;
}

/** Least-squares plane z = a·x + b·y + c; normal (−a, −b, 1) scaled to point along `up` (+1 head-ward, −1 foot-ward). */
function fitPlane(points: readonly Vec3[], up: 1 | -1): Endplate | null {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const mz = points.reduce((s, p) => s + p.z, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxz = 0;
  let syz = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    const dz = p.z - mz;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
    sxz += dx * dz;
    syz += dy * dz;
  }
  const det = sxx * syy - sxy * sxy;
  let a = 0;
  let b = 0;
  if (Math.abs(det) > 1e-9) {
    a = (sxz * syy - syz * sxy) / det;
    b = (syz * sxx - sxz * sxy) / det;
  }
  const len = Math.hypot(a, b, 1);
  return {
    centre: { x: mx, y: my, z: mz },
    normal: { x: (-a / len) * up, y: (-b / len) * up, z: (1 / len) * up },
  };
}
