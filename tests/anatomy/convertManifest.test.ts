import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { REGION_FILE_KINDS, validateLandmarksFile, validateManifest } from '../../src/anatomy/manifestFormat';
import { LEVEL_IDS, TISSUE } from '../../src/core/labels';
import { createPhantom } from '../../src/core/phantom';
import type { Vec3 } from '../../src/core/types';
import { runConvertCli } from '../../tools/anatomy/convertCore';
import { writeNiftiFolder, TEST_SOURCE } from './niftiFolderFixture';
import { createPelvisFixture } from './pelvisFixture';

const root = mkdtempSync(join(tmpdir(), 'convert-manifest-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Input folders, written once: the phantom (canal + two vertebrae) and the pelvis fixture.
const phantomIn = writeNiftiFolder(join(root, 'phantom-in'), createPhantom());
const thoracicIn = writeNiftiFolder(join(root, 'thoracic-in'), relabel(createPhantom(), { L4: 'T11', L5: 'T12' }), {
  ...TEST_SOURCE,
  region: 'thoracic',
  sourceDataset: 'Second fixture',
});
const pelvisIn = writeNiftiFolder(join(root, 'pelvis-in'), createPelvisFixture());

/** The phantom with its levels renamed (e.g. to make a thoracic fixture). */
function relabel(vol: ReturnType<typeof createPhantom>, names: Record<string, 'T11' | 'T12'>) {
  const map = new Map(Object.entries(names).map(([from, to]) => [LEVEL_IDS[from as 'L4' | 'L5'], LEVEL_IDS[to]]));
  vol.levels = vol.levels!.map((l) => map.get(l) ?? l);
  return vol;
}

function run(args: string[], options = {}) {
  const log: string[] = [];
  const error: string[] = [];
  const code = runConvertCli(args, { log: (t) => log.push(t), error: (t) => error.push(t) }, options);
  return { code, log: log.join('\n'), error: error.join('\n') };
}

function freshOut(name: string) {
  const out = join(root, name);
  mkdirSync(out);
  return out;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

function labelsAt(out: string, region: string) {
  const header = readJson(join(out, `${region}.json`));
  const labels = gunzipSync(readFileSync(join(out, `${region}.labels.bin.gz`)));
  const at = (p: Vec3) => {
    const i = Math.round((p.x - header.origin.x) / header.spacing.x);
    const j = Math.round((p.y - header.origin.y) / header.spacing.y);
    const k = Math.round((p.z - header.origin.z) / header.spacing.z);
    return labels[i + header.size.x * (j + header.size.y * k)];
  };
  const near = (p: Vec3, label: number, mm: number) => {
    for (let dz = -mm; dz <= mm; dz++)
      for (let dy = -mm; dy <= mm; dy++)
        for (let dx = -mm; dx <= mm; dx++) if (at({ x: p.x + dx, y: p.y + dy, z: p.z + dz }) === label) return true;
    return false;
  };
  return { labels, at, near };
}

describe('converter: landmarks, soft tissue and manifest', () => {
  const out = freshOut('one');
  const result = run([phantomIn, out]);

  it('writes a manifest and a landmarks file that pass the validators, and every named file exists', () => {
    expect(result.error).toBe('');
    expect(result.code).toBe(0);
    const manifest = readJson(join(out, 'manifest.json'));
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.regions.map((r: { name: string }) => r.name)).toEqual(['lumbosacral']);
    for (const kind of REGION_FILE_KINDS) expect(existsSync(join(out, manifest.regions[0].files[kind])), kind).toBe(true);
    const landmarks = readJson(join(out, 'lumbosacral.landmarks.json'));
    expect(validateLandmarksFile(landmarks)).toEqual([]);
    expect(landmarks.reviewedByOwner).toBe(false);
    expect(landmarks.levels.map((l: { level: string }) => l.level)).toEqual(['L4', 'L5']);
    expect(readdirSync(out).some((f) => f.startsWith('.partial'))).toBe(false);
  });

  it('carries the source dataset name, licence and attribution from source.json', () => {
    const [entry] = readJson(join(out, 'manifest.json')).regions;
    expect(entry.sourceDataset).toBe(TEST_SOURCE.sourceDataset);
    expect(entry.licence).toBe(TEST_SOURCE.licence);
    expect(entry.attribution).toBe(TEST_SOURCE.attribution);
    expect(entry.levels).toEqual(['L4', 'L5']);
  });

  it('writes modelled epidural space and nerve-root voxels into the label volume', () => {
    const { labels } = labelsAt(out, 'lumbosacral');
    expect(labels.includes(TISSUE.epiduralSpace)).toBe(true);
    expect(labels.includes(TISSUE.nerveRoot)).toBe(true);
  });

  it('keeps the first region’s entry when a second is added, and replaces (not duplicates) it on re-conversion', () => {
    const shared = freshOut('shared');
    expect(run([phantomIn, shared]).code).toBe(0);
    expect(run([thoracicIn, shared]).code).toBe(0);
    let names = readJson(join(shared, 'manifest.json')).regions.map((r: { name: string }) => r.name);
    expect(names).toEqual(['thoracic', 'lumbosacral']);
    expect(run([phantomIn, shared]).code).toBe(0);
    const manifest = readJson(join(shared, 'manifest.json'));
    names = manifest.regions.map((r: { name: string }) => r.name);
    expect(names).toEqual(['thoracic', 'lumbosacral']);
    expect(manifest.regions[0].sourceDataset).toBe('Second fixture');
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('converts the pelvis fixture with an L5 foramen, a sacrum entry, both crests and nerve roots at L5–S1', () => {
    const pelvisOut = freshOut('pelvis');
    const r = run([pelvisIn, pelvisOut]);
    expect(r.error).toBe('');
    const landmarks = readJson(join(pelvisOut, 'lumbosacral.landmarks.json'));
    expect(validateLandmarksFile(landmarks)).toEqual([]);
    const l5 = landmarks.levels.find((l: { level: string }) => l.level === 'L5');
    expect(l5.foramenCentre.left).toBeDefined();
    expect(l5.foramenCentre.right).toBeDefined();
    expect(landmarks.sacrum).toBeDefined();
    expect(landmarks.iliacCrest.left).toBeDefined();
    expect(landmarks.iliacCrest.right).toBeDefined();
    const { near } = labelsAt(pelvisOut, 'lumbosacral');
    for (const side of ['left', 'right'] as const) expect(near(l5.foramenCentre[side], TISSUE.nerveRoot, 2), side).toBe(true);
    expect(r.log).toMatch(/sacrum; iliac crests/);
  });

  it('stops with a clear error, writing nothing, when the region is over the size limit', () => {
    const small = freshOut('small');
    const r = run([phantomIn, small], { maxRegionBytes: 1000 });
    expect(r.code).not.toBe(0);
    expect(r.error).toMatch(/more than the 0\.00 MB limit; choose a larger voxel spacing/);
    expect(readdirSync(small)).toEqual([]);
  });
});
