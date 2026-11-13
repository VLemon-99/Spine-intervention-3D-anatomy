import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { listRegions, loadRegion, type LoaderOptions } from '../../src/anatomy/index';
import type { Manifest } from '../../src/anatomy/manifestFormat';
import { createPhantom, createPhantomLandmarks } from '../../src/core/phantom';

const size = { x: 4, y: 3, z: 2 };
const voxels = 24;
const intensity = Uint8Array.from({ length: voxels }, (_, n) => n * 10);
const labels = Uint8Array.from({ length: voxels }, (_, n) => n % 14);
const levels = Uint8Array.from({ length: voxels }, (_, n) => (n % 2 ? 23 : 0));
const landmarks = { ...createPhantomLandmarks(), region: 'lumbosacral' };

const header = {
  formatVersion: 1,
  region: 'lumbosacral',
  size,
  spacing: { x: 1, y: 0.8, z: 1.25 },
  origin: { x: -1.5, y: 20, z: -300.25 },
  orientation: [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  files: {
    intensity: { name: 'lumbosacral.intensity.bin.gz', bytes: voxels },
    labels: { name: 'lumbosacral.labels.bin.gz', bytes: voxels },
    levels: { name: 'lumbosacral.levels.bin.gz', bytes: voxels },
  },
};

const manifest: Manifest = {
  formatVersion: 1,
  regions: [
    {
      name: 'lumbosacral',
      title: 'Lumbosacral (L1–sacrum)',
      levels: ['L4', 'L5'],
      files: {
        header: 'lumbosacral.json',
        intensity: 'lumbosacral.intensity.bin.gz',
        labels: 'lumbosacral.labels.bin.gz',
        levels: 'lumbosacral.levels.bin.gz',
        landmarks: 'lumbosacral.landmarks.json',
      },
      size,
      spacing: header.spacing,
      sourceDataset: 'Test fixture',
      licence: 'CC0',
      attribution: 'Made up for a unit test',
    },
  ],
};

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));

/** A set of files served from memory; `gzip: false` serves the data files already unpacked. */
function files(over: Record<string, Uint8Array | undefined> = {}, gzip = true): Map<string, Uint8Array> {
  const pack = (b: Uint8Array) => (gzip ? new Uint8Array(gzipSync(b)) : b);
  const m = new Map<string, Uint8Array | undefined>([
    ['data/manifest.json', json(manifest)],
    ['data/lumbosacral.json', json(header)],
    ['data/lumbosacral.intensity.bin.gz', pack(intensity)],
    ['data/lumbosacral.labels.bin.gz', pack(labels)],
    ['data/lumbosacral.levels.bin.gz', pack(levels)],
    ['data/lumbosacral.landmarks.json', json({ reviewedByOwner: false, ...landmarks })],
  ]);
  for (const [k, v] of Object.entries(over)) m.set(k, v);
  return new Map([...m].filter((e): e is [string, Uint8Array] => e[1] !== undefined));
}

const served = (map: Map<string, Uint8Array>): LoaderOptions => ({
  fetch: async (url) => {
    const body = map.get(url);
    return body ? new Response(body as BodyInit, { status: 200 }) : new Response('not found', { status: 404 });
  },
});

describe('loadRegion', () => {
  it('returns the header’s name, size, spacing, origin, identity orientation, every voxel value and the landmarks', async () => {
    const { volume, landmarks: lm } = await loadRegion('lumbosacral', served(files()));
    expect(volume.region).toBe('lumbosacral');
    expect(volume.size).toEqual(size);
    expect(volume.spacing).toEqual(header.spacing);
    expect(volume.origin).toEqual(header.origin);
    expect(volume.orientation).toEqual(header.orientation);
    expect(Array.from(volume.intensity)).toEqual(Array.from(intensity));
    expect(Array.from(volume.labels)).toEqual(Array.from(labels));
    expect(Array.from(volume.levels!)).toEqual(Array.from(levels));
    expect(lm).toEqual(landmarks);
    expect('reviewedByOwner' in lm).toBe(false);
  });

  it('loads data files served already unpacked exactly like gzipped ones', async () => {
    const a = await loadRegion('lumbosacral', served(files()));
    const b = await loadRegion('lumbosacral', served(files({}, false)));
    expect(Array.from(b.volume.intensity)).toEqual(Array.from(a.volume.intensity));
    expect(Array.from(b.volume.labels)).toEqual(Array.from(a.volume.labels));
    expect(Array.from(b.volume.levels!)).toEqual(Array.from(a.volume.levels!));
  });

  it("returns the synthetic phantom for 'phantom' without any download", async () => {
    const { volume, landmarks: lm } = await loadRegion('phantom', {
      fetch: async () => {
        throw new Error('no download expected');
      },
    });
    const phantom = createPhantom();
    expect(volume.size).toEqual(phantom.size);
    expect(volume.labels).toEqual(phantom.labels);
    expect(lm).toEqual(createPhantomLandmarks());
  });

  it('rejects a name not in the manifest, without fetching any file built from it', async () => {
    const asked: string[] = [];
    const opts: LoaderOptions = {
      fetch: async (url) => {
        asked.push(url);
        return new Response(files().get(url) as BodyInit, { status: files().has(url) ? 200 : 404 });
      },
    };
    await expect(loadRegion('../secret', opts)).rejects.toThrow(/"\.\.\/secret" is not listed in manifest\.json/);
    await expect(loadRegion('cervical', opts)).rejects.toThrow(/"cervical" is not listed/);
    expect(asked.every((u) => u === 'data/manifest.json')).toBe(true);
  });

  it('rejects a data file of the wrong length with a clear message', async () => {
    const short = files({ 'data/lumbosacral.labels.bin.gz': new Uint8Array(gzipSync(new Uint8Array(23))) });
    await expect(loadRegion('lumbosacral', served(short))).rejects.toThrow(/labels data has 23 bytes but 4×3×2 = 24/);
  });

  it('rejects an invalid header with a clear message', async () => {
    const broken = files({ 'data/lumbosacral.json': json({ ...header, spacing: { x: 0, y: 1, z: 1 } }) });
    await expect(loadRegion('lumbosacral', served(broken))).rejects.toThrow(/header of region "lumbosacral" is invalid[\s\S]*spacing\.x/);
  });

  it('rejects a missing file with a clear message', async () => {
    const missing = files({ 'data/lumbosacral.landmarks.json': undefined });
    await expect(loadRegion('lumbosacral', served(missing))).rejects.toThrow(/Could not download the landmarks.*404/);
  });
});

describe('listRegions', () => {
  it('returns the manifest’s regions as name and title', async () => {
    expect(await listRegions(served(files()))).toEqual([{ name: 'lumbosacral', title: 'Lumbosacral (L1–sacrum)' }]);
  });

  it('returns an empty list for a missing manifest or one without regions', async () => {
    expect(await listRegions(served(new Map()))).toEqual([]);
    expect(await listRegions(served(files({ 'data/manifest.json': json({ formatVersion: 1, regions: [] }) })))).toEqual([]);
  });
});
