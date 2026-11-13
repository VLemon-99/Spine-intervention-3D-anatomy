// Test helper: writes a standard-layout test volume (the phantom or the pelvis
// fixture) out as a converter input folder: ct.nii.gz, segmentations/*.nii.gz
// and source.json. CT numbers are made up per tissue; masks come from labels and levels.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBone, LEVEL_CODES, LEVEL_IDS, TISSUE } from '../../src/core/labels';
import type { Volume } from '../../src/core/types';
import { writeNifti } from './niftiFixture';

/** Made-up CT numbers (HU) per tissue label; bone stays below the cortical threshold except cortical bone. */
const HU: Record<number, number> = {
  [TISSUE.air]: -1000,
  [TISSUE.skinFat]: -100,
  [TISSUE.muscle]: 40,
  [TISSUE.corticalBone]: 1200,
  [TISSUE.cancellousBone]: 300,
  [TISSUE.disc]: 80,
  [TISSUE.thecalSac]: 10,
  [TISSUE.spinalCord]: 30,
};

export interface FolderSource {
  region: string;
  sourceDataset: string;
  licence: string;
  attribution: string;
}

export const TEST_SOURCE: FolderSource = {
  region: 'lumbosacral',
  sourceDataset: 'Generated test fixture',
  licence: 'CC0 (test data)',
  attribution: 'Made up for a unit test',
};

/** Writes `vol` as an input folder at `dir`; returns `dir`. */
export function writeNiftiFolder(dir: string, vol: Volume, source: FolderSource = TEST_SOURCE): string {
  mkdirSync(join(dir, 'segmentations'), { recursive: true });
  const { size, spacing, origin } = vol;
  // Standard layout → RAS: x and y flip.
  const sform = [
    [-spacing.x, 0, 0, -origin.x],
    [0, -spacing.y, 0, -origin.y],
    [0, 0, spacing.z, origin.z],
  ];
  const dims = [size.x, size.y, size.z] as const;
  const hu = Array.from(vol.labels, (l) => HU[l] ?? 40);
  writeNifti(join(dir, 'ct.nii.gz'), { dims, data: hu, type: 'int16', spacing: [spacing.x, spacing.y, spacing.z], sform });

  const masks: Record<string, (v: number) => boolean> = {
    spinal_cord: (v) => vol.labels[v] === TISSUE.thecalSac || vol.labels[v] === TISSUE.spinalCord,
  };
  const levels = vol.levels!;
  for (const level of LEVEL_CODES.filter((l) => l !== 'sacrum' && l !== 'ilium')) {
    if (levels.includes(LEVEL_IDS[level])) masks[`vertebrae_${level}`] = (v) => levels[v] === LEVEL_IDS[level];
  }
  if (levels.includes(LEVEL_IDS.sacrum)) masks.sacrum = (v) => levels[v] === LEVEL_IDS.sacrum;
  if (levels.includes(LEVEL_IDS.ilium)) {
    const midX = (size.x - 1) / 2;
    masks.hip_left = (v) => levels[v] === LEVEL_IDS.ilium && v % size.x > midX;
    masks.hip_right = (v) => levels[v] === LEVEL_IDS.ilium && v % size.x < midX;
  }
  for (const [name, inside] of Object.entries(masks)) {
    const data = Array.from(vol.labels, (l, v) => (inside(v) && (name === 'spinal_cord' || isBone(l)) ? 1 : 0));
    writeNifti(join(dir, 'segmentations', `${name}.nii.gz`), { dims, data, type: 'uint8', spacing: [spacing.x, spacing.y, spacing.z], sform });
  }
  writeFileSync(join(dir, 'source.json'), JSON.stringify(source));
  return dir;
}
