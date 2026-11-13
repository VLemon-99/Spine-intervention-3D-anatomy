// Checks a folder of converted anatomy files (public/data or a test folder) — SPEC F1.5, F1.7.
// Returns a list of problems (empty = all good). Node only.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  checkRegionSize,
  MAX_REGION_BYTES,
  REGION_FILE_KINDS,
  validateLandmarksFile,
  validateManifest,
  type LandmarksFile,
  type Manifest,
} from '../../src/anatomy/manifestFormat';
import { REGION_DATA_KINDS, validateRegionHeader, type RegionHeader } from '../../src/anatomy/regionFormat';
import { isBone, LEVEL_IDS } from '../../src/core/labels';

/** Largest total size of all regions together: 100 MB. */
export const MAX_TOTAL_BYTES = 100_000_000;

export interface DataCheckOptions {
  maxRegionBytes?: number;
  maxTotalBytes?: number;
}

function readJson(path: string, problems: string[], what: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    problems.push(`${what} could not be read as JSON (${(e as Error).message})`);
    return undefined;
  }
}

const unpack = (bytes: Buffer) => (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);

/** Checks the manifest in `folder` and every region it lists. */
export function checkDataFolder(folder: string, options: DataCheckOptions = {}): string[] {
  const problems: string[] = [];
  const manifestPath = join(folder, 'manifest.json');
  if (!existsSync(manifestPath)) return ['manifest.json is missing'];
  const raw = readJson(manifestPath, problems, 'manifest.json');
  if (raw === undefined) return problems;
  const manifestErrors = validateManifest(raw);
  if (manifestErrors.length) return manifestErrors.map((e) => `manifest.json: ${e}`);
  const manifest = raw as Manifest;

  let total = 0;
  for (const region of manifest.regions) {
    const where = `Region "${region.name}"`;
    const missing = REGION_FILE_KINDS.filter((kind) => !existsSync(join(folder, region.files[kind])));
    for (const kind of missing) problems.push(`${where}: file ${region.files[kind]} (${kind}) is missing`);
    if (missing.length) continue;

    const bytes = REGION_FILE_KINDS.map((kind) => statSync(join(folder, region.files[kind])).size);
    total += bytes.reduce((a, b) => a + b, 0);
    const size = checkRegionSize(bytes, options.maxRegionBytes ?? MAX_REGION_BYTES);
    if (!size.ok) problems.push(`${where}: ${size.message}`);

    const header = readJson(join(folder, region.files.header), problems, `${where} header`);
    const headerErrors = header === undefined ? ['unreadable'] : validateRegionHeader(header);
    if (headerErrors.length) {
      problems.push(...headerErrors.map((e) => `${where} header: ${e}`));
      continue;
    }
    const h = header as RegionHeader;
    if (h.region !== region.name) problems.push(`${where}: its header names region "${h.region}"`);
    if (h.size.x !== region.size.x || h.size.y !== region.size.y || h.size.z !== region.size.z) {
      problems.push(`${where}: header size and manifest size differ`);
    }

    const voxels = h.size.x * h.size.y * h.size.z;
    const data: Partial<Record<(typeof REGION_DATA_KINDS)[number], Uint8Array>> = {};
    for (const kind of REGION_DATA_KINDS) {
      try {
        const d = unpack(readFileSync(join(folder, region.files[kind])));
        if (d.length !== voxels) problems.push(`${where}: ${kind} data unpacks to ${d.length} bytes, ${voxels} expected`);
        else data[kind] = d;
      } catch (e) {
        problems.push(`${where}: ${kind} data could not be unpacked (${(e as Error).message})`);
      }
    }

    const lm = readJson(join(folder, region.files.landmarks), problems, `${where} landmarks`);
    const lmErrors = lm === undefined ? ['unreadable'] : validateLandmarksFile(lm);
    if (lmErrors.length) {
      problems.push(...lmErrors.map((e) => `${where} landmarks: ${e}`));
      continue;
    }
    if (!data.labels || !data.levels) continue;
    for (const level of (lm as LandmarksFile).levels) {
      const c = level.bodyCentre;
      const i = Math.round((c.x - h.origin.x) / h.spacing.x);
      const j = Math.round((c.y - h.origin.y) / h.spacing.y);
      const k = Math.round((c.z - h.origin.z) / h.spacing.z);
      if (i < 0 || j < 0 || k < 0 || i >= h.size.x || j >= h.size.y || k >= h.size.z) {
        problems.push(`${where}: ${level.level} body centre lies outside the volume`);
        continue;
      }
      const v = i + h.size.x * (j + h.size.y * k);
      if (!isBone(data.labels[v])) problems.push(`${where}: ${level.level} body centre is not in bone`);
      else if (data.levels[v] !== LEVEL_IDS[level.level]) problems.push(`${where}: ${level.level} body centre lies in another level's bone`);
    }
  }
  if (total > (options.maxTotalBytes ?? MAX_TOTAL_BYTES)) {
    problems.push(`All regions together total ${(total / 1e6).toFixed(2)} MB, more than ${((options.maxTotalBytes ?? MAX_TOTAL_BYTES) / 1e6).toFixed(2)} MB`);
  }
  return problems;
}
