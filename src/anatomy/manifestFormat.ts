// Manifest and landmarks file formats (SPEC F1.5), shared by the converter (Node)
// and the loader (browser). Plain TypeScript; validators written by hand.
//
// public/data/manifest.json lists the regions on offer. Each region's files sit
// next to it: <region>.json (header, see regionFormat.ts), the three .bin.gz data
// files and <region>.landmarks.json (a Landmarks object plus "reviewedByOwner").
import { LEVEL_CODES, type LevelCode } from '../core/labels';
import type { Landmarks, Vec3 } from '../core/types';
import { isValidRegionName } from './regionFormat';

export const MANIFEST_FORMAT_VERSION = 1;

/** The three regions the app offers (SPEC F1.5). */
export const REGION_NAMES = ['cervical', 'thoracic', 'lumbosacral'] as const;
export type ManifestRegionName = (typeof REGION_NAMES)[number];

/** Largest total size of one region's files: 25 MB (25 000 000 bytes). */
export const MAX_REGION_BYTES = 25_000_000;

export const REGION_FILE_KINDS = ['header', 'intensity', 'labels', 'levels', 'landmarks'] as const;
export type RegionFileKind = (typeof REGION_FILE_KINDS)[number];

export interface ManifestRegion {
  name: ManifestRegionName;
  /** Text shown in the region picker, e.g. 'Lumbosacral (L1–sacrum)'. */
  title: string;
  /** Vertebral levels the region covers, head to foot. */
  levels: LevelCode[];
  /** File names, in the same folder as the manifest. */
  files: Record<RegionFileKind, string>;
  size: { x: number; y: number; z: number };
  spacing: Vec3;
  sourceDataset: string;
  licence: string;
  attribution: string;
}

export interface Manifest {
  formatVersion: typeof MANIFEST_FORMAT_VERSION;
  regions: ManifestRegion[];
}

/** A landmarks file: the shared Landmarks object plus the owner-review flag. */
export type LandmarksFile = Landmarks & { reviewedByOwner: boolean };

export function landmarksFileName(region: string): string {
  return `${region}.landmarks.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '';

/** A plain file name: no folders, no '..', only letters, digits, dots, dashes and underscores. */
export function isSafeFileName(name: unknown): boolean {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..') && name.length <= 128;
}

function checkVec(v: unknown, where: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${where} is missing`);
    return;
  }
  for (const a of ['x', 'y', 'z']) {
    if (typeof v[a] !== 'number' || !Number.isFinite(v[a])) errors.push(`${where}.${a} must be a finite number`);
  }
}

/** Lists everything wrong with a manifest (empty list = valid). */
export function validateManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ['manifest must be a JSON object'];
  if (value.formatVersion !== MANIFEST_FORMAT_VERSION) errors.push(`formatVersion must be ${MANIFEST_FORMAT_VERSION}`);
  if (!Array.isArray(value.regions)) return [...errors, 'regions must be a list'];
  const seen = new Set<string>();
  value.regions.forEach((r: unknown, n: number) => {
    const where = `regions[${n}]`;
    if (!isObject(r)) {
      errors.push(`${where} must be an object`);
      return;
    }
    if (!(REGION_NAMES as readonly unknown[]).includes(r.name)) {
      errors.push(`${where}.name must be one of ${REGION_NAMES.join(', ')} (got ${JSON.stringify(r.name)})`);
    } else if (seen.has(r.name as string)) errors.push(`${where}.name ${JSON.stringify(r.name)} is listed twice`);
    else seen.add(r.name as string);
    if (!isText(r.title)) errors.push(`${where}.title must be a non-empty text`);
    if (!Array.isArray(r.levels) || r.levels.length === 0) errors.push(`${where}.levels must be a non-empty list`);
    else {
      for (const l of r.levels) {
        if (!(LEVEL_CODES as readonly unknown[]).includes(l)) errors.push(`${where}.levels: unknown level ${JSON.stringify(l)}`);
      }
    }
    if (!isObject(r.files)) errors.push(`${where}.files is missing`);
    else {
      for (const kind of REGION_FILE_KINDS) {
        const f = r.files[kind];
        if (f === undefined) errors.push(`${where}.files.${kind} is missing`);
        else if (!isSafeFileName(f)) errors.push(`${where}.files.${kind} must be a plain file name without folders or '..' (got ${JSON.stringify(f)})`);
      }
    }
    if (!isObject(r.size)) errors.push(`${where}.size is missing`);
    else {
      for (const a of ['x', 'y', 'z']) {
        if (!Number.isInteger(r.size[a]) || (r.size[a] as number) < 1) errors.push(`${where}.size.${a} must be a whole number of at least 1`);
      }
    }
    checkVec(r.spacing, `${where}.spacing`, errors);
    if (isObject(r.spacing)) {
      for (const a of ['x', 'y', 'z']) if (!((r.spacing[a] as number) > 0)) errors.push(`${where}.spacing.${a} must be above 0`);
    }
    for (const field of ['sourceDataset', 'licence', 'attribution']) {
      if (!isText(r[field])) errors.push(`${where}.${field} must be a non-empty text`);
    }
  });
  return errors;
}

const SIDES = ['left', 'right'] as const;

function checkSided(v: unknown, where: string, errors: string[], partial = false): void {
  if (!isObject(v)) {
    errors.push(`${where} is missing`);
    return;
  }
  for (const side of SIDES) {
    if (partial && v[side] === undefined) continue;
    checkVec(v[side], `${where}.${side}`, errors);
  }
}

function checkEndplate(v: unknown, where: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${where} is missing`);
    return;
  }
  checkVec(v.centre, `${where}.centre`, errors);
  checkVec(v.normal, `${where}.normal`, errors);
  const n = v.normal as Record<string, number> | undefined;
  if (isObject(n) && [n.x, n.y, n.z].every(Number.isFinite) && Math.abs(Math.hypot(n.x, n.y, n.z) - 1) > 1e-3) {
    errors.push(`${where}.normal must be a unit vector (length 1)`);
  }
}

/** Lists everything wrong with a landmarks file (empty list = valid). */
export function validateLandmarksFile(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ['landmarks file must be a JSON object'];
  if (typeof value.reviewedByOwner !== 'boolean') errors.push('reviewedByOwner must be true or false');
  if (!isValidRegionName(value.region)) errors.push(`region must be a region name (got ${JSON.stringify(value.region)})`);
  if (!Array.isArray(value.levels)) errors.push('levels must be a list');
  else {
    value.levels.forEach((l: unknown, n: number) => {
      const where = `levels[${n}]`;
      if (!isObject(l)) {
        errors.push(`${where} must be an object`);
        return;
      }
      if (!(LEVEL_CODES as readonly unknown[]).includes(l.level)) errors.push(`${where}.level: unknown level ${JSON.stringify(l.level)}`);
      checkVec(l.bodyCentre, `${where}.bodyCentre`, errors);
      checkSided(l.pedicleCentre, `${where}.pedicleCentre`, errors);
      checkEndplate(l.superiorEndplate, `${where}.superiorEndplate`, errors);
      checkEndplate(l.inferiorEndplate, `${where}.inferiorEndplate`, errors);
      checkSided(l.superiorArticularProcessTip, `${where}.superiorArticularProcessTip`, errors);
      if (l.foramenCentre !== undefined) checkSided(l.foramenCentre, `${where}.foramenCentre`, errors, true);
    });
  }
  if (value.sacrum !== undefined) {
    if (!isObject(value.sacrum)) errors.push('sacrum must be an object');
    else {
      checkEndplate(value.sacrum.superiorEndplate, 'sacrum.superiorEndplate', errors);
      checkSided(value.sacrum.superiorArticularProcessTip, 'sacrum.superiorArticularProcessTip', errors);
    }
  }
  if (value.iliacCrest !== undefined) checkSided(value.iliacCrest, 'iliacCrest', errors);
  return errors;
}

/** Throws one clear error if the manifest is invalid. */
export function parseManifest(value: unknown, source = 'manifest.json'): Manifest {
  const errors = validateManifest(value);
  if (errors.length) throw new Error(`${source} is invalid:\n- ${errors.join('\n- ')}`);
  return value as Manifest;
}

/** Throws one clear error if the landmarks file is invalid. */
export function parseLandmarksFile(value: unknown, source = 'landmarks file'): LandmarksFile {
  const errors = validateLandmarksFile(value);
  if (errors.length) throw new Error(`${source} is invalid:\n- ${errors.join('\n- ')}`);
  return value as LandmarksFile;
}

/** Adds up a region's file sizes (bytes) and checks the total against the limit (25 MB unless given). */
export function checkRegionSize(
  fileBytes: readonly number[],
  limitBytes: number = MAX_REGION_BYTES,
): { ok: boolean; totalBytes: number; message: string } {
  const totalBytes = fileBytes.reduce((a, b) => a + b, 0);
  const mb = (b: number) => (b / 1_000_000).toFixed(2);
  return totalBytes <= limitBytes
    ? { ok: true, totalBytes, message: `Region files total ${mb(totalBytes)} MB (limit ${mb(limitBytes)} MB)` }
    : {
        ok: false,
        totalBytes,
        message: `Region files total ${mb(totalBytes)} MB, more than the ${mb(limitBytes)} MB limit; choose a larger voxel spacing`,
      };
}
