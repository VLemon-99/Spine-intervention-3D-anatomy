import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { LEVEL_IDS, TISSUE } from '../../src/core/labels';
import { validateRegionHeader } from '../../src/anatomy/regionFormat';
import { runConvertCli } from '../../tools/anatomy/convertCore';
import { huToIntensity } from '../../tools/anatomy/intensity';
import { loadLabelMap } from '../../tools/anatomy/labels';
import { writeNifti } from './niftiFixture';

const root = mkdtempSync(join(tmpdir(), 'convert-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Tiny CT stored RAS (i → patient's right, j → front, k → head), 1 mm voxels.
const [NX, NY, NZ] = [12, 10, 8];
const OFFSET = [5, -20, 100];
const at = (i: number, j: number, k: number) => i + NX * (j + NY * k);
const inBox = (i: number, j: number, k: number, lo: number[], hi: number[]) =>
  i >= lo[0] && i <= hi[0] && j >= lo[1] && j <= hi[1] && k >= lo[2] && k <= hi[2];

const BOXES = {
  vertebrae_L4: [[4, 3, 4], [7, 6, 6]],
  vertebrae_L5: [[4, 3, 1], [7, 6, 3]],
  spinal_cord: [[5, 7, 1], [6, 8, 6]],
  aorta: [[2, 0, 0], [3, 1, 7]],
  inferior_vena_cava: [[8, 0, 0], [9, 1, 7]],
  mystery_organ: [[0, 0, 0], [11, 9, 7]],
} as const;

const hu = Array.from({ length: NX * NY * NZ }, (_, n) => -1100 + ((n * 37) % 3300));
const SOURCE = {
  region: 'lumbosacral',
  sourceDataset: 'Generated test fixture',
  licence: 'CC0',
  attribution: 'Made up for a unit test',
};

function makeInput(name: string, opts: { source?: unknown; ct?: boolean; sourceText?: string } = {}) {
  const dir = join(root, name);
  mkdirSync(join(dir, 'segmentations'), { recursive: true });
  const affine = [
    [1, 0, 0, OFFSET[0]],
    [0, 1, 0, OFFSET[1]],
    [0, 0, 1, OFFSET[2]],
  ];
  if (opts.ct !== false) writeNifti(join(dir, 'ct.nii.gz'), { dims: [NX, NY, NZ], data: hu, type: 'int16', sform: affine });
  for (const [mask, [lo, hi]] of Object.entries(BOXES)) {
    const data = Array.from({ length: NX * NY * NZ }, (_, n) => {
      const i = n % NX;
      const j = Math.floor(n / NX) % NY;
      const k = Math.floor(n / (NX * NY));
      return inBox(i, j, k, [...lo], [...hi]) ? 1 : 0;
    });
    writeNifti(join(dir, 'segmentations', `${mask}.nii.gz`), { dims: [NX, NY, NZ], data, type: 'uint8', sform: affine });
  }
  writeFileSync(join(dir, 'source.json'), opts.sourceText ?? JSON.stringify(opts.source ?? SOURCE));
  const out = join(root, `${name}-out`);
  mkdirSync(out, { recursive: true });
  return { dir, out };
}

function run(args: string[]) {
  const lines: string[] = [];
  const errors: string[] = [];
  const code = runConvertCli(args, { log: (t) => lines.push(t), error: (t) => errors.push(t) });
  return { code, log: lines.join('\n'), error: errors.join('\n') };
}

/** Expected label of stored voxel (i, j, k), worked out by hand from the rules. */
function expectedLabel(i: number, j: number, k: number): number {
  const t = loadLabelMap().thresholds!;
  const h = hu[at(i, j, k)];
  const inside = (m: keyof typeof BOXES) => inBox(i, j, k, [...BOXES[m][0]], [...BOXES[m][1]]);
  if (inside('vertebrae_L4') || inside('vertebrae_L5')) return h >= t.bone.corticalFromHu ? TISSUE.corticalBone : TISSUE.cancellousBone;
  if (inside('spinal_cord')) return TISSUE.thecalSac;
  if (inside('aorta')) return TISSUE.artery;
  if (inside('inferior_vena_cava')) return TISSUE.vein;
  if (h >= t.unmasked.muscleFromHu) return TISSUE.muscle;
  if (h >= t.unmasked.skinFatFromHu) return TISSUE.skinFat;
  return TISSUE.air;
}

describe('anatomy converter', () => {
  it('turns a generated fixture folder into the expected region file set', () => {
    const { dir, out } = makeInput('good');
    const result = run([dir, out]);
    expect(result.error).toBe('');
    expect(result.code).toBe(0);

    const header = JSON.parse(readFileSync(join(out, 'lumbosacral.json'), 'utf8'));
    expect(validateRegionHeader(header)).toEqual([]);
    // The bones ± 10 mm margin reach every edge of this tiny scan, so the whole scan is kept.
    // Standard voxel (0, 0, 0) is the stored voxel at the patient's right-front-foot corner: (NX−1, NY−1, 0).
    expect(header).toEqual({
      formatVersion: 1,
      region: 'lumbosacral',
      size: { x: NX, y: NY, z: NZ },
      spacing: { x: 1, y: 1, z: 1 },
      origin: { x: -(OFFSET[0] + NX - 1), y: -(OFFSET[1] + NY - 1), z: OFFSET[2] },
      orientation: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
      files: {
        intensity: { name: 'lumbosacral.intensity.bin.gz', bytes: NX * NY * NZ },
        labels: { name: 'lumbosacral.labels.bin.gz', bytes: NX * NY * NZ },
        levels: { name: 'lumbosacral.levels.bin.gz', bytes: NX * NY * NZ },
      },
    });

    const read = (kind: string) => gunzipSync(readFileSync(join(out, `lumbosacral.${kind}.bin.gz`)));
    const intensity = read('intensity');
    const labels = read('labels');
    const levels = read('levels');
    for (let k = 0; k < NZ; k++)
      for (let j = 0; j < NY; j++)
        for (let i = 0; i < NX; i++) {
          // Standard (i, j, k) ← stored (NX−1−i, NY−1−j, k).
          const [si, sj] = [NX - 1 - i, NY - 1 - j];
          const v = i + NX * (j + NY * k);
          expect(intensity[v]).toBe(huToIntensity(hu[at(si, sj, k)]));
          expect(labels[v]).toBe(expectedLabel(si, sj, k));
          const level = inBox(si, sj, k, [4, 3, 4], [7, 6, 6]) ? LEVEL_IDS.L4 : inBox(si, sj, k, [4, 3, 1], [7, 6, 3]) ? LEVEL_IDS.L5 : 0;
          expect(levels[v]).toBe(level);
        }
    // Owner-approved update (2026-11-12, F1-S18): the converter also writes the landmarks file and the manifest.
    expect(readdirSync(out).sort()).toEqual([
      'lumbosacral.intensity.bin.gz',
      'lumbosacral.json',
      'lumbosacral.labels.bin.gz',
      'lumbosacral.landmarks.json',
      'lumbosacral.levels.bin.gz',
      'manifest.json',
    ]);
  });

  it('reports ignored masks, missing levels, size, spacing and file sizes', () => {
    const { dir, out } = makeInput('report');
    const { code, log } = run([dir, out]);
    expect(code).toBe(0);
    expect(log).toMatch(/Ignored masks.*mystery_organ/);
    expect(log).toMatch(/Missing levels: L1, L2, L3, sacrum/);
    expect(log).toMatch(/Region: lumbosacral/);
    expect(log).toMatch(/Size: 12 × 10 × 8/);
    expect(log).toMatch(/Spacing: 1 × 1 × 1 mm/);
    expect(log).toMatch(/lumbosacral\.labels\.bin\.gz +\d+ bytes/);
  });

  it('prints the usage line and fails without arguments', () => {
    const { code, error } = run([]);
    expect(code).not.toBe(0);
    expect(error).toContain('<input-folder> <output-folder>');
  });

  describe('fails clearly and writes no region files', () => {
    const expectFailure = (args: string[], out: string, message: RegExp) => {
      const { code, error } = run(args);
      expect(code).not.toBe(0);
      expect(error).toMatch(message);
      expect(readdirSync(out)).toEqual([]);
    };

    it('for a missing input folder', () => {
      const out = join(root, 'nofolder-out');
      mkdirSync(out);
      expectFailure([join(root, 'does-not-exist'), out], out, /Input folder not found/);
    });

    it('for a missing ct file', () => {
      const { dir, out } = makeInput('noct', { ct: false });
      expectFailure([dir, out], out, /No CT found.*ct\.nii\.gz/);
    });

    it('for a broken source.json', () => {
      const bad = makeInput('badjson', { sourceText: '{ "region": "lumbosacral", ' });
      expectFailure([bad.dir, bad.out], bad.out, /source\.json could not be read as JSON/);
      const missing = makeInput('missingfield', { source: { region: 'lumbosacral', licence: 'x', attribution: 'y' } });
      expectFailure([missing.dir, missing.out], missing.out, /sourceDataset must be a non-empty text/);
      const window = makeInput('badwindow', { source: { ...SOURCE, window: { lower: 100, upper: -100 } } });
      expectFailure([window.dir, window.out], window.out, /window: .*lower end must be below/);
      const spacing = makeInput('badspacing', { source: { ...SOURCE, voxelSpacingMm: 0 } });
      expectFailure([spacing.dir, spacing.out], spacing.out, /voxelSpacingMm/);
    });

    it('for an unknown region', () => {
      const { dir, out } = makeInput('badregion', { source: { ...SOURCE, region: 'pelvis' } });
      expectFailure([dir, out], out, /region must be one of cervical, thoracic, lumbosacral.*"pelvis"/);
    });

    it('for a region with none of its levels in the scan', () => {
      const { dir, out } = makeInput('nolevels', { source: { ...SOURCE, region: 'cervical' } });
      expectFailure([dir, out], out, /none of its levels/);
    });
  });
});
