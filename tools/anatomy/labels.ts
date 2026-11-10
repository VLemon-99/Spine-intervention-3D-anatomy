// Dataset masks → our tissue labels, through tools/anatomy/label-map.json (SPEC F1.3).
// Plain Node code; reads the table with node:fs.
import { readFileSync } from 'node:fs';
import { isBone, LEVEL_CODES, TISSUE, type LevelCode, type TissueKey } from '../../src/core/labels';
import type { Size3 } from './standardLayout';

export interface LabelMapEntry {
  /** Mask file name without .nii / .nii.gz, as in the dataset (e.g. 'vertebrae_L4'). */
  mask: string;
  /** Our tissue label key (a key of TISSUE). */
  tissue: TissueKey;
  /** Vertebral level, for bone entries only. */
  level?: LevelCode;
}

export interface LabelMap {
  status: string;
  reviewedByOwner: boolean;
  note: string;
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
  const problems = validateLabelMap(map);
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
