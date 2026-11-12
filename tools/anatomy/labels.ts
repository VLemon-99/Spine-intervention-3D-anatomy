// Dataset masks → our tissue labels, through tools/anatomy/label-map.json (SPEC F1.3).
// Plain Node code; reads the table with node:fs.
import { readFileSync } from 'node:fs';
import { isBone, LEVEL_CODES, LEVEL_IDS, NO_LEVEL, TISSUE, type LevelCode, type TissueKey } from '../../src/core/labels';
import type { Size3 } from './standardLayout';

export interface LabelMapEntry {
  /** Mask file name without .nii / .nii.gz, as in the dataset (e.g. 'vertebrae_L4'). */
  mask: string;
  /** Our tissue label key (a key of TISSUE). */
  tissue: TissueKey;
  /** Vertebral level, for bone entries only. */
  level?: LevelCode;
}

/** Draft CT-number thresholds (HU) for the owner to review. */
export interface LabelThresholds {
  /** Bone voxels at or above this are cortical, below it cancellous. */
  bone: { corticalFromHu: number };
  /** Voxels covered by no mask: the highest class whose 'from' value the CT number reaches (below airFromHu is air too). */
  unmasked: { airFromHu: number; skinFatFromHu: number; muscleFromHu: number };
}

export interface LabelMap {
  status: string;
  reviewedByOwner: boolean;
  note: string;
  thresholds?: LabelThresholds;
  entries: LabelMapEntry[];
}

export interface Mask {
  name: string;
  size: Size3;
  /** Yes/no per voxel: any value above 0 counts as inside. */
  data: ArrayLike<number>;
}

export interface LabelResult {
  labels: Uint8Array;
  /** Names of masks that are not in the table (ignored), for the converter's report. */
  ignored: string[];
}

const LABEL_MAP_URL = new URL('./label-map.json', import.meta.url);

/** Reads and checks tools/anatomy/label-map.json. */
export function loadLabelMap(): LabelMap {
  const map = JSON.parse(readFileSync(LABEL_MAP_URL, 'utf8')) as unknown;
  const problems = [...validateLabelMap(map), ...validateThresholds(map)];
  if (problems.length) throw new Error(`tools/anatomy/label-map.json is invalid:\n- ${problems.join('\n- ')}`);
  return map as LabelMap;
}

/** Lists everything wrong with a label table (empty list = valid). */
export function validateLabelMap(map: unknown): string[] {
  const problems: string[] = [];
  if (typeof map !== 'object' || map === null) return ['the table is not an object'];
  const m = map as Partial<LabelMap>;
  if (typeof m.reviewedByOwner !== 'boolean') problems.push('reviewedByOwner must be true or false');
  if (!Array.isArray(m.entries)) return [...problems, 'entries must be a list'];
  const seen = new Set<string>();
  m.entries.forEach((e: Partial<LabelMapEntry>, n) => {
    const where = `entry ${n} (${JSON.stringify(e?.mask)})`;
    if (typeof e?.mask !== 'string' || e.mask === '') problems.push(`${where}: mask must be a non-empty name`);
    else if (seen.has(e.mask)) problems.push(`${where}: mask listed twice`);
    else seen.add(e.mask);
    if (typeof e?.tissue !== 'string' || !Object.hasOwn(TISSUE, e.tissue)) {
      problems.push(`${where}: tissue ${JSON.stringify(e?.tissue)} is not a key of TISSUE`);
      return;
    }
    const bone = isBone(TISSUE[e.tissue]);
    if (bone && !(LEVEL_CODES as readonly string[]).includes(e.level as string)) {
      problems.push(`${where}: bone entries need a level from LEVEL_CODES (got ${JSON.stringify(e.level)})`);
    }
    if (!bone && e.level !== undefined) problems.push(`${where}: only bone entries have a level`);
  });
  return problems;
}

/**
 * Labels every voxel from the masks. Bone masks win over all others; among
 * the rest (and among bones) the table's order wins. Voxels in no mask stay air.
 */
export function labelsFromMasks(ctSize: Size3, masks: readonly Mask[], map: LabelMap): LabelResult {
  const count = ctSize.x * ctSize.y * ctSize.z;
  const order = new Map(map.entries.map((e, n) => [e.mask, n]));
  const ignored: string[] = [];
  const names = new Set<string>();
  const used: { entry: LabelMapEntry; rank: number; data: ArrayLike<number> }[] = [];

  for (const mask of masks) {
    if (names.has(mask.name)) throw new Error(`Mask "${mask.name}" was given twice`);
    names.add(mask.name);
    const { x, y, z } = mask.size;
    if (x !== ctSize.x || y !== ctSize.y || z !== ctSize.z || mask.data.length !== count) {
      throw new Error(
        `Mask "${mask.name}" is ${x}×${y}×${z} voxels but the CT is ${ctSize.x}×${ctSize.y}×${ctSize.z}; ` +
          'every mask must have the same size as the CT',
      );
    }
    const n = order.get(mask.name);
    if (n === undefined) {
      ignored.push(mask.name);
      continue;
    }
    const entry = map.entries[n];
    used.push({ entry, rank: (isBone(TISSUE[entry.tissue]) ? 0 : map.entries.length) + n, data: mask.data });
  }

  // Paint the lowest priority first so higher-priority masks overwrite it.
  used.sort((a, b) => b.rank - a.rank);
  const labels = new Uint8Array(count);
  for (const { entry, data } of used) {
    const id = TISSUE[entry.tissue];
    for (let v = 0; v < count; v++) if (data[v] > 0) labels[v] = id;
  }
  return { labels, ignored: ignored.sort() };
}

/** Lists everything wrong with a table's CT-number thresholds (empty list = valid). */
export function validateThresholds(map: unknown): string[] {
  const t = (map as Partial<LabelMap> | null)?.thresholds;
  if (typeof t !== 'object' || t === null) return ['thresholds are missing'];
  const problems: string[] = [];
  const num = (v: unknown, name: string) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) problems.push(`thresholds.${name} must be a finite number`);
  };
  num(t.bone?.corticalFromHu, 'bone.corticalFromHu');
  const u = t.unmasked;
  num(u?.airFromHu, 'unmasked.airFromHu');
  num(u?.skinFatFromHu, 'unmasked.skinFatFromHu');
  num(u?.muscleFromHu, 'unmasked.muscleFromHu');
  if (problems.length === 0 && !(u.airFromHu < u.skinFatFromHu && u.skinFatFromHu < u.muscleFromHu)) {
    problems.push('thresholds.unmasked must rise: airFromHu < skinFatFromHu < muscleFromHu');
  }
  return problems;
}

/**
 * Second pass after labelsFromMasks, using the CT numbers (HU, same voxel order):
 * bone → cortical or cancellous by the bone threshold; voxels covered by no mask
 * (still air) → air, skin/fat or muscle; voxels from non-bone masks are left alone.
 * Returns a new array.
 */
export function refineLabelsByHu(labels: Uint8Array, hu: ArrayLike<number>, thresholds: LabelThresholds): Uint8Array {
  if (hu.length !== labels.length) {
    throw new Error(`CT has ${hu.length} voxels but the label volume has ${labels.length}`);
  }
  const { corticalFromHu } = thresholds.bone;
  const { skinFatFromHu, muscleFromHu } = thresholds.unmasked;
  const out = new Uint8Array(labels.length);
  for (let v = 0; v < labels.length; v++) {
    const label = labels[v];
    const h = hu[v];
    if (isBone(label)) out[v] = h >= corticalFromHu ? TISSUE.corticalBone : TISSUE.cancellousBone;
    else if (label === TISSUE.air) {
      // NaN fails every comparison and stays air.
      out[v] = h >= muscleFromHu ? TISSUE.muscle : h >= skinFatFromHu ? TISSUE.skinFat : TISSUE.air;
    } else out[v] = label;
  }
  return out;
}

/**
 * The level volume (SPEC F1.3): for every bone voxel in `labels`, the level id
 * (LEVEL_IDS) of the bone mask it belongs to — the first in the table's order
 * where bone masks overlap — and NO_LEVEL (0) for every voxel that is not bone.
 * `masks` are the same masks given to labelsFromMasks (sizes already checked there).
 */
export function levelsFromMasks(labels: Uint8Array, masks: readonly Mask[], map: LabelMap): Uint8Array {
  const order = new Map(map.entries.map((e, n) => [e.mask, n]));
  const bones = masks
    .map((mask) => ({ mask, n: order.get(mask.name) }))
    .filter((m): m is { mask: Mask; n: number } => m.n !== undefined && isBone(TISSUE[map.entries[m.n].tissue]))
    .sort((a, b) => b.n - a.n); // last in table order first, so the first overwrites
  const levels = new Uint8Array(labels.length);
  for (const { mask, n } of bones) {
    if (mask.data.length !== labels.length) {
      throw new Error(`Mask "${mask.name}" has ${mask.data.length} voxels but the label volume has ${labels.length}`);
    }
    const id = LEVEL_IDS[map.entries[n].level as LevelCode];
    for (let v = 0; v < labels.length; v++) if (mask.data[v] > 0) levels[v] = id;
  }
  // Only bone voxels keep a level.
  for (let v = 0; v < labels.length; v++) if (!isBone(labels[v])) levels[v] = NO_LEVEL;
  return levels;
}
