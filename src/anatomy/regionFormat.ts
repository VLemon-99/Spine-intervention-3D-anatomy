// Region file format (SPEC F1.1), shared by the converter (Node) and the loader (browser).
// Plain TypeScript: no Node-only or browser-only code here.
//
// A region is a set of files named after the region:
//   <region>.json              header (this file's RegionHeader)
//   <region>.intensity.bin.gz  8-bit intensity per voxel
//   <region>.labels.bin.gz     8-bit tissue label per voxel
//   <region>.levels.bin.gz     8-bit vertebral level per voxel
// Each data file is gzipped, in the Volume's index order i + size.x × (j + size.y × k).
// Orientation is always the identity (the standard layout: i → left, j → back, k → head).
import type { Vec3 } from '../core/types';

export const REGION_FORMAT_VERSION = 1;

export const REGION_DATA_KINDS = ['intensity', 'labels', 'levels'] as const;
export type RegionDataKind = (typeof REGION_DATA_KINDS)[number];

export interface RegionDataFile {
  /** File name, in the same folder as the header. */
  name: string;
  /** Uncompressed length in bytes (one byte per voxel). */
  bytes: number;
}

export interface RegionHeader {
  formatVersion: typeof REGION_FORMAT_VERSION;
  region: string;
  size: { x: number; y: number; z: number };
  spacing: Vec3;
  origin: Vec3;
  orientation: [Vec3, Vec3, Vec3];
  files: Record<RegionDataKind, RegionDataFile>;
}

/** Region names become file names: lower-case letters, digits and dashes only. */
export const REGION_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const IDENTITY_ORIENTATION: [Vec3, Vec3, Vec3] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

export function isValidRegionName(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 64 && REGION_NAME_PATTERN.test(name);
}

export function headerFileName(region: string): string {
  return `${region}.json`;
}

export function dataFileName(region: string, kind: RegionDataKind): string {
  return `${region}.${kind}.bin.gz`;
}

/** Lists everything wrong with a region header (empty list = valid). */
export function validateRegionHeader(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['header must be a JSON object'];
  const h = value as Record<string, unknown>;

  if (h.formatVersion !== REGION_FORMAT_VERSION) {
    errors.push(`formatVersion must be ${REGION_FORMAT_VERSION} (got ${JSON.stringify(h.formatVersion)})`);
  }
  const nameOk = isValidRegionName(h.region);
  if (!nameOk) {
    errors.push(`region must be a name of lower-case letters, digits and dashes (got ${JSON.stringify(h.region)})`);
  }

  const size = vec(h.size, 'size', errors);
  if (size) {
    for (const a of ['x', 'y', 'z'] as const) {
      if (!Number.isInteger(size[a]) || size[a] < 1) errors.push(`size.${a} must be a whole number of at least 1`);
    }
  }
  const spacing = vec(h.spacing, 'spacing', errors);
  if (spacing) {
    for (const a of ['x', 'y', 'z'] as const) if (!(spacing[a] > 0)) errors.push(`spacing.${a} must be above 0`);
  }
  vec(h.origin, 'origin', errors);

  const o = h.orientation;
  if (!Array.isArray(o) || o.length !== 3) errors.push('orientation is missing or is not a list of three directions');
  else {
    o.forEach((d, n) => {
      const v = vec(d, `orientation[${n}]`, errors);
      const want = IDENTITY_ORIENTATION[n];
      if (v && (v.x !== want.x || v.y !== want.y || v.z !== want.z)) {
        errors.push(`orientation[${n}] must be ${JSON.stringify(want)} (region files always use the standard layout)`);
      }
    });
  }

  const files = h.files;
  if (typeof files !== 'object' || files === null) errors.push('files is missing');
  else {
    const voxels = size && errors.every((e) => !e.startsWith('size')) ? size.x * size.y * size.z : undefined;
    for (const kind of REGION_DATA_KINDS) {
      const f = (files as Record<string, unknown>)[kind] as Partial<RegionDataFile> | undefined;
      if (typeof f !== 'object' || f === null) {
        errors.push(`files.${kind} is missing`);
        continue;
      }
      if (nameOk && f.name !== dataFileName(h.region as string, kind)) {
        errors.push(`files.${kind}.name must be ${JSON.stringify(dataFileName(h.region as string, kind))}`);
      }
      if (!Number.isInteger(f.bytes) || (f.bytes as number) < 1) errors.push(`files.${kind}.bytes must be a whole number`);
      else if (voxels !== undefined && f.bytes !== voxels) {
        errors.push(`files.${kind}.bytes is ${f.bytes} but size ${size!.x}×${size!.y}×${size!.z} needs ${voxels}`);
      }
    }
  }
  return errors;
}

/** Throws one clear error if the header is invalid; otherwise returns it typed. */
export function parseRegionHeader(value: unknown, source = 'region header'): RegionHeader {
  const errors = validateRegionHeader(value);
  if (errors.length) throw new Error(`${source} is invalid:\n- ${errors.join('\n- ')}`);
  return value as RegionHeader;
}

function vec(value: unknown, name: string, errors: string[]): Vec3 | undefined {
  if (typeof value !== 'object' || value === null) {
    errors.push(`${name} is missing`);
    return undefined;
  }
  const v = value as Record<string, unknown>;
  let ok = true;
  for (const a of ['x', 'y', 'z']) {
    if (typeof v[a] !== 'number' || !Number.isFinite(v[a])) {
      errors.push(`${name}.${a} must be a finite number`);
      ok = false;
    }
  }
  return ok ? (v as unknown as Vec3) : undefined;
}
