// The anatomy converter's work (SPEC F1.1–F1.3): a NIfTI folder → one region file set.
// tools/anatomy/convert.ts is the command-line entry; this file holds the steps so tests can call them.
//
// Input folder:
//   ct.nii.gz (or ct.nii)       the CT, in HU
//   segmentations/*.nii[.gz]    one yes/no mask per structure, named as in the dataset
//   source.json                 { region, sourceDataset, licence, attribution,
//                                 optional window: { lower, upper } (HU),
//                                 optional voxelSpacingMm: number or { x, y, z } }
// Steps: read → standard layout → intensity window → labels and levels → crop → resample
// → landmarks → soft-tissue modeller → write the region files and <region>.landmarks.json
// → add or replace this region's entry in the output folder's manifest.json.
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkRegionSize,
  landmarksFileName,
  MAX_REGION_BYTES,
  parseLandmarksFile,
  parseManifest,
  type Manifest,
  type ManifestRegion,
} from '../../src/anatomy/manifestFormat';
import { dataFileName, headerFileName, IDENTITY_ORIENTATION, REGION_DATA_KINDS, type RegionHeader } from '../../src/anatomy/regionFormat';
import type { Landmarks } from '../../src/core/types';
import { DEFAULT_HU_WINDOW, huVolumeToIntensity, makeHuWindow, type HuWindow } from './intensity';
import { labelsFromMasks, levelsFromMasks, loadLabelMap, refineLabelsByHu, type Mask } from './labels';
import { computeRegionLandmarks } from './landmarks';
import { readNifti } from './nifti';
import { cropToRegion, REGIONS, type RegionName } from './regions';
import { checkTargetSpacing, DEFAULT_TARGET_SPACING_MM, resampleVolume } from './resample';
import { modelSoftTissue } from './softTissue';
import { applyLayoutPlan, planStandardLayout, type Size3 } from './standardLayout';
import { writeRegion } from './writeRegion';

export const USAGE = 'Usage: npm run anatomy:convert -- <input-folder> <output-folder>';

export interface SourceInfo {
  region: RegionName;
  sourceDataset: string;
  licence: string;
  attribution: string;
  window: HuWindow;
  voxelSpacingMm: Size3;
}

export interface ConvertReport {
  source: SourceInfo;
  header: RegionHeader;
  /** Written files with their sizes on disk (bytes). */
  files: { name: string; bytes: number }[];
  /** Masks not in the mapping table. */
  ignoredMasks: string[];
  /** Region levels with no bone in the scan. */
  missingLevels: string[];
  landmarks: Landmarks;
  /** Notes from the landmark finder (e.g. an iliac crest cut off by the scan's edge). */
  landmarkNotes: string[];
}

export interface ConvertOptions {
  /** Largest total size of the region's files (bytes); 25 MB unless a test lowers it. */
  maxRegionBytes?: number;
}

const MANIFEST_NAME = 'manifest.json';

/** Reads the output folder's manifest.json, or an empty one if there is none. */
function readOutputManifest(outputFolder: string): Manifest {
  const path = join(outputFolder, MANIFEST_NAME);
  if (!existsSync(path)) return { formatVersion: 1, regions: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`The output folder's manifest.json could not be read as JSON (${(e as Error).message})`, { cause: e });
  }
  return parseManifest(raw, `The output folder's manifest.json`);
}

/** Reads and checks source.json. */
export function readSourceInfo(path: string): SourceInfo {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`source.json could not be read as JSON (${(e as Error).message})`, { cause: e });
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('source.json must hold a JSON object');
  const s = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof s.region !== 'string' || !Object.hasOwn(REGIONS, s.region)) {
    problems.push(`region must be one of ${Object.keys(REGIONS).join(', ')} (got ${JSON.stringify(s.region)})`);
  }
  for (const field of ['sourceDataset', 'licence', 'attribution']) {
    if (typeof s[field] !== 'string' || (s[field] as string).trim() === '') problems.push(`${field} must be a non-empty text`);
  }
  let window: HuWindow = { ...DEFAULT_HU_WINDOW };
  if (s.window !== undefined) {
    const w = s.window as Partial<HuWindow> | null;
    if (typeof w?.lower !== 'number' || typeof w?.upper !== 'number') {
      problems.push('window must be { "lower": number, "upper": number } (HU)');
    } else {
      try {
        window = makeHuWindow(w.lower, w.upper);
      } catch (e) {
        problems.push(`window: ${(e as Error).message}`);
      }
    }
  }
  let voxelSpacingMm: Size3 = checkTargetSpacing(DEFAULT_TARGET_SPACING_MM);
  if (s.voxelSpacingMm !== undefined) {
    try {
      voxelSpacingMm = checkTargetSpacing(s.voxelSpacingMm as number | Size3);
    } catch (e) {
      problems.push(`voxelSpacingMm: ${(e as Error).message}`);
    }
  }
  if (problems.length) throw new Error(`source.json is invalid:\n- ${problems.join('\n- ')}`);
  return {
    region: s.region as RegionName,
    sourceDataset: s.sourceDataset as string,
    licence: s.licence as string,
    attribution: s.attribution as string,
    window,
    voxelSpacingMm,
  };
}

function isFolder(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

const NIFTI_EXT = /\.nii(\.gz)?$/;

/** Runs every step; writes nothing unless all of them succeed. */
export function convertFolder(inputFolder: string, outputFolder: string, options: ConvertOptions = {}): ConvertReport {
  if (!isFolder(inputFolder)) throw new Error(`Input folder not found: ${inputFolder}`);
  if (!isFolder(outputFolder)) throw new Error(`Output folder not found: ${outputFolder} (create it first)`);
  const ctPath = ['ct.nii.gz', 'ct.nii'].map((n) => join(inputFolder, n)).find((p) => existsSync(p));
  if (!ctPath) throw new Error(`No CT found: expected ct.nii.gz or ct.nii in ${inputFolder}`);
  const segFolder = join(inputFolder, 'segmentations');
  if (!isFolder(segFolder)) throw new Error(`No segmentations folder found in ${inputFolder}`);
  const sourcePath = join(inputFolder, 'source.json');
  if (!existsSync(sourcePath)) throw new Error(`No source.json found in ${inputFolder}`);

  const source = readSourceInfo(sourcePath);
  const map = loadLabelMap();
  const manifest = readOutputManifest(outputFolder);

  // Read → standard layout.
  const ct = readNifti(ctPath);
  const plan = planStandardLayout(ct.size, ct.affine);
  const hu = applyLayoutPlan(plan, ct.data);

  const masks: Mask[] = [];
  for (const file of readdirSync(segFolder).filter((f) => NIFTI_EXT.test(f)).sort()) {
    const name = file.replace(NIFTI_EXT, '');
    const m = readNifti(join(segFolder, file));
    if (m.size.x !== ct.size.x || m.size.y !== ct.size.y || m.size.z !== ct.size.z) {
      throw new Error(
        `Mask "${name}" is ${m.size.x}×${m.size.y}×${m.size.z} voxels but the CT is ${ct.size.x}×${ct.size.y}×${ct.size.z}`,
      );
    }
    const offBy = Math.max(...m.affine.slice(0, 3).flatMap((row, r) => row.map((v, c) => Math.abs(v - ct.affine[r][c]))));
    if (offBy > 1e-3) throw new Error(`Mask "${name}" does not line up with the CT (its position information differs)`);
    const yes = Uint8Array.from(m.data, (v) => (v > 0 ? 1 : 0));
    masks.push({ name, size: plan.outSize, data: applyLayoutPlan(plan, yes) });
  }

  // Intensity window, labels and levels.
  const intensity = huVolumeToIntensity(hu, source.window);
  const masked = labelsFromMasks(plan.outSize, masks, map);
  const labels = refineLabelsByHu(masked.labels, hu, map.thresholds!);
  const levels = levelsFromMasks(labels, masks, map);

  // Crop → resample.
  const cropped = cropToRegion(
    { size: plan.outSize, spacing: plan.spacing, origin: plan.origin, intensity, labels, levels },
    source.region,
  );
  const resampled = resampleVolume(cropped, source.voxelSpacingMm);

  // Landmarks (from bone and canal), then the modelled soft tissue.
  const region = {
    region: source.region,
    size: resampled.size,
    spacing: resampled.spacing,
    origin: resampled.origin,
    orientation: IDENTITY_ORIENTATION.map((d) => ({ ...d })) as typeof IDENTITY_ORIENTATION,
    intensity: resampled.intensity,
    labels: resampled.labels,
    levels: resampled.levels!,
  };
  const found = computeRegionLandmarks(region);
  const modelled = modelSoftTissue(region, found.landmarks);
  const landmarksFile = parseLandmarksFile(
    { reviewedByOwner: false, ...found.landmarks },
    `Landmarks of region "${source.region}"`,
  );

  // Write into a scratch folder first, then move the finished files into place.
  const scratch = mkdtempSync(join(outputFolder, `.partial-${source.region}-`));
  try {
    const { header } = writeRegion(scratch, { ...modelled, levels: modelled.levels });
    const lmName = landmarksFileName(source.region);
    writeFileSync(join(scratch, lmName), `${JSON.stringify(landmarksFile, null, 2)}\n`);
    const names = [headerFileName(source.region), ...REGION_DATA_KINDS.map((k) => dataFileName(source.region, k)), lmName];
    const files = names.map((name) => ({ name, bytes: statSync(join(scratch, name)).size }));
    const size = checkRegionSize(
      files.map((f) => f.bytes),
      options.maxRegionBytes ?? MAX_REGION_BYTES,
    );
    if (!size.ok) throw new Error(`Region "${source.region}": ${size.message}`);

    const entry: ManifestRegion = {
      name: source.region,
      title: REGIONS[source.region].title,
      levels: REGIONS[source.region].levels.filter((l) => !cropped.missingLevels.includes(l)),
      files: {
        header: headerFileName(source.region),
        intensity: header.files.intensity.name,
        labels: header.files.labels.name,
        levels: header.files.levels.name,
        landmarks: lmName,
      },
      size: { ...header.size },
      spacing: { ...header.spacing },
      sourceDataset: source.sourceDataset,
      licence: source.licence,
      attribution: source.attribution,
    };
    const others = manifest.regions.filter((r) => r.name !== source.region);
    const order = Object.keys(REGIONS);
    const regions = [...others, entry].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    const updated = parseManifest({ ...manifest, regions }, 'The updated manifest');
    writeFileSync(join(scratch, MANIFEST_NAME), `${JSON.stringify(updated, null, 2)}\n`);

    for (const name of [...names, MANIFEST_NAME]) renameSync(join(scratch, name), join(outputFolder, name));
    return {
      source,
      header,
      files,
      ignoredMasks: masked.ignored,
      missingLevels: cropped.missingLevels,
      landmarks: found.landmarks,
      landmarkNotes: found.notes,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function formatReport(r: ConvertReport): string {
  const h = r.header;
  const total = r.files.reduce((sum, f) => sum + f.bytes, 0);
  return [
    `Region: ${h.region} (${REGIONS[r.source.region].title})`,
    `Size: ${h.size.x} × ${h.size.y} × ${h.size.z} voxels`,
    `Spacing: ${h.spacing.x} × ${h.spacing.y} × ${h.spacing.z} mm`,
    'Files:',
    ...r.files.map((f) => `  ${f.name}  ${f.bytes} bytes`),
    `  total ${total} bytes (${(total / 1e6).toFixed(2)} MB)`,
    `Ignored masks (not in the mapping table): ${r.ignoredMasks.length ? r.ignoredMasks.join(', ') : 'none'}`,
    `Missing levels: ${r.missingLevels.length ? r.missingLevels.join(', ') : 'none'}`,
    `Landmarks found for levels: ${r.landmarks.levels.map((l) => l.level).join(', ') || 'none'}` +
      `${r.landmarks.sacrum ? '; sacrum' : ''}${r.landmarks.iliacCrest ? '; iliac crests' : ''}`,
    ...r.landmarkNotes.map((n) => `Note: ${n}`),
    'Manifest: manifest.json updated (other regions kept)',
  ].join('\n');
}

export interface Output {
  log: (text: string) => void;
  error: (text: string) => void;
}

/** The command: returns the exit code (0 = success). */
export function runConvertCli(args: readonly string[], out: Output = console, options: ConvertOptions = {}): number {
  const [inputFolder, outputFolder] = args;
  if (!inputFolder || !outputFolder) {
    out.error(USAGE);
    return 1;
  }
  try {
    out.log(formatReport(convertFolder(inputFolder, outputFolder, options)));
    return 0;
  } catch (e) {
    out.error(`Conversion failed: ${(e as Error).message}`);
    return 1;
  }
}
