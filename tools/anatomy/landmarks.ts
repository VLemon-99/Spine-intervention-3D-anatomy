// Landmarks computed from the label and level volumes (SPEC F1.5).
// Works on volumes in the standard layout (identity orientation): voxel (i, j, k)
// sits at origin + (i, j, k) × spacing in patient mm (+x left, +y back, +z head).
// Results are approximations for the owner to review on real anatomy.
import { isBone, LEVEL_CODES, LEVEL_IDS, TISSUE, type LevelCode } from '../../src/core/labels';
import type { Endplate, Landmarks, LevelLandmarks, SacrumLandmarks, Sided, Vec3, Volume } from '../../src/core/types';

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
  const tallest = range(all.map((c) => c.top - c.bottom + 1))[1];
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

// ── Pedicles and foramina (F1-S11) ──────────────────────────────────────────

/** How far (mm) beyond the canal's side wall a pedicle voxel may lie. */
export const PEDICLE_REACH_MM = 10;

export type LevelParts = BodyLandmarks & Pick<LevelLandmarks, 'pedicleCentre' | 'foramenCentre'>;

interface CanalBox {
  centreX: number; // voxel i (fractional)
  halfWidth: number; // voxels along i
  jMin: number;
  jMax: number;
}

/** The canal beside a level: the canal voxels in the level's slices (or a stand-in just behind the body). */
function canalBeside(vol: VolumeGrid, bone: readonly number[], body: readonly number[]): CanalBox {
  const { x: nx, y: ny } = vol.size;
  const [kMin, kMax] = range(bone.map((v) => ijk(vol, v)[2]));
  let sum = 0;
  let n = 0;
  let iMin = Infinity;
  let iMax = -Infinity;
  let jMin = Infinity;
  let jMax = -Infinity;
  for (let k = kMin; k <= kMax; k++)
    for (let j = 0; j < ny; j++) {
      const row = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) {
        if (!CANAL_LABELS.has(vol.labels[row + i])) continue;
        sum += i;
        n++;
        if (i < iMin) iMin = i;
        if (i > iMax) iMax = i;
        if (j < jMin) jMin = j;
        if (j > jMax) jMax = j;
      }
    }
  if (n > 0) {
    const centreX = sum / n;
    return { centreX, halfWidth: Math.max(centreX - iMin, iMax - centreX), jMin, jMax };
  }
  // No canal voxels: assume a canal just behind the body, a third of the body's width wide and as deep.
  const b = body.map((v) => ijk(vol, v));
  const bi = b.map((p) => p[0]);
  const bodyBack = range(b.map((p) => p[1]))[1];
  const [biMin, biMax] = range(bi);
  const width = biMax - biMin + 1;
  const centreX = bi.reduce((a, c) => a + c, 0) / bi.length;
  return { centreX, halfWidth: width / 6, jMin: bodyBack + 1, jMax: bodyBack + Math.round(width / 3) };
}

/** Pedicle voxels on each side: the level's bone beside the canal, within the canal's front-to-back range. */
function pedicleVoxels(vol: VolumeGrid, bone: readonly number[], canal: CanalBox): Sided<number[]> {
  const reach = canal.halfWidth + PEDICLE_REACH_MM / vol.spacing.x;
  const out: Sided<number[]> = { left: [], right: [] };
  for (const v of bone) {
    const [i, j] = ijk(vol, v);
    if (j < canal.jMin || j > canal.jMax) continue;
    const dx = i - canal.centreX;
    if (Math.abs(dx) <= canal.halfWidth || Math.abs(dx) > reach) continue;
    // Standard layout: +i is +x, the patient's left.
    (dx > 0 ? out.left : out.right).push(v);
  }
  return out;
}

/** The level below in LEVEL_CODES order (L5 → sacrum). */
function levelBelow(level: LevelCode): LevelCode | undefined {
  const next = LEVEL_CODES[LEVEL_CODES.indexOf(level) + 1];
  return next === 'ilium' ? undefined : next;
}

/**
 * Foramen centre on one side: under the pedicle's (x, y), midway between the
 * pedicle's lowest voxel and the highest bone of the level below in the
 * pedicle's footprint columns. Moved to the nearest non-bone voxel of that
 * column if it lands on bone. Undefined when there is no bone below.
 */
function foramenCentre(vol: VolumeGrid, pedicle: readonly number[], belowId: number): Vec3 | undefined {
  if (pedicle.length === 0) return undefined;
  const { x: nx, y: ny } = vol.size;
  const nxy = nx * ny;
  const pts = pedicle.map((v) => ijk(vol, v));
  const bottom = range(pts.map((p) => p[2]))[0];
  const columns = new Set(pts.map((p) => p[0] + nx * p[1]));
  let top = -1;
  for (const col of columns) {
    for (let k = bottom - 1; k > top; k--) {
      const v = col + nxy * k;
      if (vol.levels![v] === belowId && isBone(vol.labels[v])) {
        top = k;
        break;
      }
    }
  }
  if (top < 0) return undefined;
  const mi = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const mj = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const mid = (bottom + top) / 2;
  const [ci, cj] = [Math.round(mi), Math.round(mj)];
  const isBoneAt = (k: number) => isBone(vol.labels[ci + nx * (cj + ny * k)]);
  if (!isBoneAt(Math.round(mid))) return position(vol, mi, mj, mid);
  for (let d = 1; d < bottom - top; d++) {
    for (const k of [Math.round(mid) - d, Math.round(mid) + d]) {
      if (k > top && k < bottom && !isBoneAt(k)) return position(vol, mi, mj, k);
    }
  }
  return undefined;
}

function meanPosition(vol: VolumeGrid, voxels: readonly number[]): Vec3 {
  const pts = voxels.map((v) => ijk(vol, v));
  const n = pts.length;
  return position(
    vol,
    pts.reduce((s, p) => s + p[0], 0) / n,
    pts.reduce((s, p) => s + p[1], 0) / n,
    pts.reduce((s, p) => s + p[2], 0) / n,
  );
}

/**
 * Body, endplates, pedicles and foramina for every typical level present.
 * A foramen is listed under the level above it; the lowest level has none,
 * except L5 when the sacrum is in the volume (the L5–S1 foramen).
 */
export function findLevelParts(vol: VolumeGrid): LevelParts[] {
  const byLevel = boneVoxelsByLevel(vol);
  const out: LevelParts[] = [];
  for (const body of findBodyLandmarks(vol)) {
    const bone = byLevel.get(LEVEL_IDS[body.level])!;
    const canal = canalBeside(vol, bone, bodyVoxels(vol, bone));
    const ped = pedicleVoxels(vol, bone, canal);
    if (ped.left.length === 0 || ped.right.length === 0) continue;
    const parts: LevelParts = {
      ...body,
      pedicleCentre: { left: meanPosition(vol, ped.left), right: meanPosition(vol, ped.right) },
    };
    const below = levelBelow(body.level);
    if (below && byLevel.has(LEVEL_IDS[below])) {
      const left = foramenCentre(vol, ped.left, LEVEL_IDS[below]);
      const right = foramenCentre(vol, ped.right, LEVEL_IDS[below]);
      if (left || right) parts.foramenCentre = { ...(left ? { left } : {}), ...(right ? { right } : {}) };
    }
    out.push(parts);
  }
  return out;
}

/** Smallest and largest value (a loop, so it works on very long lists). */
function range(values: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

// ── Superior articular processes and the whole Landmarks object (F1-S12) ────

/** How far (mm) beyond the canal's side wall the articular pillars may lie. */
export const ARTICULAR_REACH_MM = 20;

/**
 * Tip of the superior articular process on each side: the highest voxels of
 * the level's bone behind (+y of) the canal and beside it (not over its
 * midline, where the lamina and spinous process are). The tip is the middle of
 * those highest voxels, kept on one of them.
 */
function superiorArticularTips(vol: VolumeGrid, bone: readonly number[], canal: CanalBox): Sided<Vec3> | undefined {
  const reach = canal.halfWidth + ARTICULAR_REACH_MM / vol.spacing.x;
  const sides: Sided<{ top: number; voxels: number[] }> = { left: { top: -1, voxels: [] }, right: { top: -1, voxels: [] } };
  for (const v of bone) {
    const [i, j, k] = ijk(vol, v);
    if (j <= canal.jMax) continue;
    const dx = i - canal.centreX;
    if (Math.abs(dx) <= canal.halfWidth || Math.abs(dx) > reach) continue;
    const side = dx > 0 ? sides.left : sides.right;
    if (k > side.top) {
      side.top = k;
      side.voxels = [v];
    } else if (k === side.top) side.voxels.push(v);
  }
  if (sides.left.voxels.length === 0 || sides.right.voxels.length === 0) return undefined;
  return { left: centreInside(vol, sides.left.voxels), right: centreInside(vol, sides.right.voxels) };
}

/** Complete LevelLandmarks for every typical level present (C3 … L5), head to foot. */
export function findLevelLandmarks(vol: VolumeGrid): LevelLandmarks[] {
  const byLevel = boneVoxelsByLevel(vol);
  const out: LevelLandmarks[] = [];
  for (const parts of findLevelParts(vol)) {
    const bone = byLevel.get(LEVEL_IDS[parts.level])!;
    const canal = canalBeside(vol, bone, bodyVoxels(vol, bone));
    const tips = superiorArticularTips(vol, bone, canal);
    if (!tips) continue;
    const { level, bodyCentre, pedicleCentre, superiorEndplate, inferiorEndplate, foramenCentre } = parts;
    out.push({
      level,
      bodyCentre,
      pedicleCentre,
      superiorEndplate,
      inferiorEndplate,
      superiorArticularProcessTip: tips,
      ...(foramenCentre ? { foramenCentre } : {}),
    });
  }
  return out;
}

/** The whole Landmarks object for a region volume (see computeRegionLandmarks for the report). */
export function computeLandmarks(vol: VolumeGrid & { region: string }): Landmarks {
  return computeRegionLandmarks(vol).landmarks;
}

// ── Sacrum and iliac crests (F1-S23) ────────────────────────────────────────

/** Only the top of the sacrum (S1) is used: bone within this distance (mm) below the sacrum's highest voxel. */
export const S1_DEPTH_MM = 35;

/** The S1 endplate is fitted on body columns within this many canal half-widths of the canal's midline (keeps the sacral wings out). */
const S1_BODY_HALF_WIDTHS = 2;

export interface LandmarkResult {
  landmarks: Landmarks;
  /** Plain-language notes for the converter's report (e.g. a crest cut off by the volume's edge). */
  notes: string[];
}

/** Landmarks of the region plus notes: levels, and the sacrum and iliac crests when present. */
export function computeRegionLandmarks(vol: VolumeGrid & { region: string }): LandmarkResult {
  const notes: string[] = [];
  const landmarks: Landmarks = { region: vol.region, levels: findLevelLandmarks(vol) };
  const byLevel = boneVoxelsByLevel(vol);
  const sacrumBone = byLevel.get(LEVEL_IDS.sacrum);
  let midlineX: number | undefined;
  if (sacrumBone && sacrumBone.length > 0) {
    const found = findSacrum(vol, sacrumBone);
    midlineX = found.midlineX;
    if (found.sacrum) landmarks.sacrum = found.sacrum;
    else notes.push('Sacrum landmarks could not be found (no clear S1 top face or articular processes).');
  }
  const ilium = byLevel.get(LEVEL_IDS.ilium);
  if (ilium && ilium.length > 0) {
    const crest = findIliacCrests(vol, ilium, midlineX ?? canalMidline(vol) ?? (vol.size.x - 1) / 2, notes);
    if (crest) landmarks.iliacCrest = crest;
  }
  return { landmarks, notes };
}

function findSacrum(vol: VolumeGrid, sacrumBone: readonly number[]): { sacrum?: SacrumLandmarks; midlineX: number } {
  const top = range(sacrumBone.map((v) => ijk(vol, v)[2]))[1];
  const lowest = top - S1_DEPTH_MM / vol.spacing.z;
  const s1 = sacrumBone.filter((v) => ijk(vol, v)[2] >= lowest);
  const body = bodyVoxels(vol, s1);
  const canal = canalBeside(vol, s1, body.length ? body : s1);
  const midlineX = canal.centreX;
  const core = body.filter((v) => Math.abs(ijk(vol, v)[0] - canal.centreX) <= S1_BODY_HALF_WIDTHS * canal.halfWidth);
  const ends = core.length ? fitEndplates(vol, core) : null;
  const tips = superiorArticularTips(vol, s1, canal);
  if (!ends || !tips) return { midlineX };
  return { sacrum: { superiorEndplate: ends.superiorEndplate, superiorArticularProcessTip: tips }, midlineX };
}

/** Mean i of all canal voxels, if any. */
function canalMidline(vol: VolumeGrid): number | undefined {
  let sum = 0;
  let n = 0;
  for (let v = 0; v < vol.labels.length; v++) {
    if (CANAL_LABELS.has(vol.labels[v])) {
      sum += v % vol.size.x;
      n++;
    }
  }
  return n ? sum / n : undefined;
}

/**
 * Highest (+z) hip-bone point on each side of the midline (voxel i). Left out,
 * with a note, when either side is missing or a hip bone reaches the volume's
 * top edge (its crest is cut off).
 */
function findIliacCrests(vol: VolumeGrid, ilium: readonly number[], midlineX: number, notes: string[]): Sided<Vec3> | undefined {
  const topK = vol.size.z - 1;
  const sides: Sided<{ top: number; voxels: number[] }> = { left: { top: -1, voxels: [] }, right: { top: -1, voxels: [] } };
  for (const v of ilium) {
    const [i, , k] = ijk(vol, v);
    const side = i > midlineX ? sides.left : sides.right;
    if (k > side.top) {
      side.top = k;
      side.voxels = [v];
    } else if (k === side.top) side.voxels.push(v);
  }
  for (const name of ['left', 'right'] as const) {
    if (sides[name].voxels.length === 0) {
      notes.push(`Iliac crests left out: no ${name} hip bone in the volume.`);
      return undefined;
    }
    if (sides[name].top === topK) {
      notes.push(`Iliac crests left out: the ${name} hip bone reaches the top edge of the volume, so its crest is cut off.`);
      return undefined;
    }
  }
  return { left: centreInside(vol, sides.left.voxels), right: centreInside(vol, sides.right.voxels) };
}
