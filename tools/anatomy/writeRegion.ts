// Writes one region file set into a folder (SPEC F1.1). Node only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Vec3 } from '../../src/core/types';
import {
  dataFileName,
  headerFileName,
  IDENTITY_ORIENTATION,
  isValidRegionName,
  parseRegionHeader,
  REGION_DATA_KINDS,
  REGION_FORMAT_VERSION,
  type RegionHeader,
} from '../../src/anatomy/regionFormat';

export interface RegionVolume {
  region: string;
  size: { x: number; y: number; z: number };
  spacing: Vec3;
  origin: Vec3;
  intensity: Uint8Array;
  labels: Uint8Array;
  levels: Uint8Array;
}

/** Writes <region>.json and the three gzipped data files; returns the header and file paths. */
export function writeRegion(folder: string, vol: RegionVolume): { header: RegionHeader; paths: string[] } {
  if (!isValidRegionName(vol.region)) {
    throw new Error(`Region name ${JSON.stringify(vol.region)} may only use lower-case letters, digits and dashes`);
  }
  const voxels = vol.size.x * vol.size.y * vol.size.z;
  for (const kind of REGION_DATA_KINDS) {
    if (vol[kind].length !== voxels) {
      throw new Error(`Region "${vol.region}": ${kind} has ${vol[kind].length} voxels but the size needs ${voxels}`);
    }
  }
  const header = parseRegionHeader(
    {
      formatVersion: REGION_FORMAT_VERSION,
      region: vol.region,
      size: { ...vol.size },
      spacing: { ...vol.spacing },
      origin: { ...vol.origin },
      orientation: IDENTITY_ORIENTATION.map((d) => ({ ...d })),
      files: Object.fromEntries(
        REGION_DATA_KINDS.map((kind) => [kind, { name: dataFileName(vol.region, kind), bytes: voxels }]),
      ),
    },
    `Region "${vol.region}" header`,
  );

  mkdirSync(folder, { recursive: true });
  const paths: string[] = [];
  for (const kind of REGION_DATA_KINDS) {
    const path = join(folder, header.files[kind].name);
    writeFileSync(path, gzipSync(vol[kind], { level: 9 }));
    paths.push(path);
  }
  const headerPath = join(folder, headerFileName(vol.region));
  writeFileSync(headerPath, `${JSON.stringify(header, null, 2)}\n`);
  paths.unshift(headerPath);
  return { header, paths };
}
