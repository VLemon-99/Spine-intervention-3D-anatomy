import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPhantomLandmarks } from '../../src/core/phantom';
import {
  checkRegionSize,
  MAX_REGION_BYTES,
  validateLandmarksFile,
  validateManifest,
  type Manifest,
} from '../../src/anatomy/manifestFormat';

const example = (): Manifest => ({
  formatVersion: 1,
  regions: [
    {
      name: 'lumbosacral',
      title: 'Lumbosacral (L1–sacrum)',
      levels: ['L1', 'L2', 'L3', 'L4', 'L5', 'sacrum'],
      files: {
        header: 'lumbosacral.json',
        intensity: 'lumbosacral.intensity.bin.gz',
        labels: 'lumbosacral.labels.bin.gz',
        levels: 'lumbosacral.levels.bin.gz',
        landmarks: 'lumbosacral.landmarks.json',
      },
      size: { x: 180, y: 160, z: 260 },
      spacing: { x: 1, y: 1, z: 1 },
      sourceDataset: 'Example dataset (made up for a test)',
      licence: 'CC BY 4.0',
      attribution: 'Example attribution text',
    },
  ],
});

const phantomFile = () => JSON.parse(JSON.stringify({ reviewedByOwner: false, ...createPhantomLandmarks() }));
const sacrum = {
  superiorEndplate: { centre: { x: 0, y: -13, z: -6 }, normal: { x: 0, y: 0, z: 1 } },
  superiorArticularProcessTip: { left: { x: 15, y: 18, z: -4 }, right: { x: -15, y: 18, z: -4 } },
};
const iliacCrest = { left: { x: 40, y: 0, z: 20 }, right: { x: -40, y: 0, z: 18 } };

const bad = (change: (m: ReturnType<typeof example> & Record<string, unknown>) => void) => {
  const m = example() as ReturnType<typeof example> & Record<string, unknown>;
  change(m);
  return validateManifest(m).join('\n');
};
type Loose = Record<string, unknown> & { regions: Record<string, unknown>[] };

describe('manifest and landmarks formats', () => {
  it('accepts a complete example manifest and the phantom’s landmarks in file form', () => {
    expect(validateManifest(example())).toEqual([]);
    expect(validateLandmarksFile(phantomFile())).toEqual([]);
  });

  it('rejects a missing field', () => {
    for (const field of ['name', 'title', 'levels', 'files', 'size', 'spacing', 'sourceDataset', 'licence', 'attribution']) {
      expect(bad((m) => delete (m as unknown as Loose).regions[0][field]), field).toMatch(new RegExp(field));
    }
    expect(bad((m) => delete (m.regions[0].files as Partial<Record<string, string>>).landmarks)).toMatch(/files\.landmarks is missing/);
    const lm = phantomFile();
    delete lm.levels[0].bodyCentre;
    expect(validateLandmarksFile(lm).join('\n')).toMatch(/levels\[0\]\.bodyCentre is missing/);
    const noFlag = phantomFile();
    delete noFlag.reviewedByOwner;
    expect(validateLandmarksFile(noFlag).join('\n')).toMatch(/reviewedByOwner/);
  });

  it('rejects an unknown region name', () => {
    expect(bad((m) => ((m as unknown as Loose).regions[0].name = 'pelvis'))).toMatch(/name must be one of cervical, thoracic, lumbosacral/);
  });

  it('rejects an unknown level name', () => {
    expect(bad((m) => ((m as unknown as Loose).regions[0].levels = ['L4', 'L6']))).toMatch(/unknown level "L6"/);
    const lm = phantomFile();
    lm.levels[1].level = 'S9';
    expect(validateLandmarksFile(lm).join('\n')).toMatch(/unknown level "S9"/);
  });

  it('rejects a point with a non-number coordinate', () => {
    const lm = phantomFile();
    lm.levels[0].pedicleCentre.left.y = 'seven';
    expect(validateLandmarksFile(lm).join('\n')).toMatch(/pedicleCentre\.left\.y must be a finite number/);
    expect(bad((m) => ((m.regions[0].spacing as unknown as Record<string, unknown>).z = null))).toMatch(/spacing\.z must be a finite number/);
  });

  it('rejects an empty attribution text', () => {
    expect(bad((m) => (m.regions[0].attribution = '  '))).toMatch(/attribution must be a non-empty text/);
  });

  it("rejects a file name containing a path separator or '..'", () => {
    for (const name of ['../secret.json', 'sub/lumbosacral.json', 'a\\b.json', '..']) {
      expect(bad((m) => (m.regions[0].files.header = name)), name).toMatch(/files\.header must be a plain file name/);
    }
  });

  it('accepts sacrum and iliac crest entries, and rejects an incomplete sacrum or a one-sided crest', () => {
    expect(validateLandmarksFile({ ...phantomFile(), sacrum, iliacCrest })).toEqual([]);
    const { superiorEndplate: _drop, ...noEndplate } = sacrum;
    void _drop;
    expect(validateLandmarksFile({ ...phantomFile(), sacrum: noEndplate }).join('\n')).toMatch(/sacrum\.superiorEndplate is missing/);
    expect(validateLandmarksFile({ ...phantomFile(), iliacCrest: { left: iliacCrest.left } }).join('\n')).toMatch(/iliacCrest\.right is missing/);
  });

  it('passes the size check at 25 MB and fails just above it', () => {
    expect(MAX_REGION_BYTES).toBe(25_000_000);
    expect(checkRegionSize([20_000_000, 5_000_000]).ok).toBe(true);
    const over = checkRegionSize([20_000_000, 5_000_001]);
    expect(over.ok).toBe(false);
    expect(over.totalBytes).toBe(25_000_001);
    expect(over.message).toMatch(/larger voxel spacing/);
  });

  it('has a valid committed public/data/manifest.json that lists no regions', () => {
    const committed = JSON.parse(readFileSync(new URL('../../public/data/manifest.json', import.meta.url), 'utf8'));
    expect(validateManifest(committed)).toEqual([]);
    expect(committed.regions).toEqual([]);
  });
});
