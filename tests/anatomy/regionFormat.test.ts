import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { REGION_DATA_KINDS, validateRegionHeader } from '../../src/anatomy/regionFormat';
import { writeRegion, type RegionVolume } from '../../tools/anatomy/writeRegion';

const dir = mkdtempSync(join(tmpdir(), 'region-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const size = { x: 4, y: 3, z: 2 };
const vol: RegionVolume = {
  region: 'test-lumbar-1',
  size,
  spacing: { x: 1, y: 0.8, z: 1.25 },
  origin: { x: -1.5, y: 20, z: -300.25 },
  intensity: Uint8Array.from({ length: 24 }, (_, n) => n * 10),
  labels: Uint8Array.from({ length: 24 }, (_, n) => n % 14),
  levels: Uint8Array.from({ length: 24 }, (_, n) => (n % 3 === 0 ? 0 : 23)),
};
const { header, paths } = writeRegion(join(dir, 'out'), vol);
const readHeader = () => JSON.parse(readFileSync(join(dir, 'out', 'test-lumbar-1.json'), 'utf8'));

describe('region file format', () => {
  it('reads back the same size, spacing, origin and every intensity, label and level value', () => {
    expect(paths.map((p) => p.split('/').pop())).toEqual([
      'test-lumbar-1.json',
      'test-lumbar-1.intensity.bin.gz',
      'test-lumbar-1.labels.bin.gz',
      'test-lumbar-1.levels.bin.gz',
    ]);
    const h = readHeader();
    expect(h).toEqual(header);
    expect(h.region).toBe('test-lumbar-1');
    expect(h.size).toEqual(size);
    expect(h.spacing).toEqual(vol.spacing);
    expect(h.origin).toEqual(vol.origin);
    for (const kind of REGION_DATA_KINDS) {
      const data = gunzipSync(readFileSync(join(dir, 'out', h.files[kind].name)));
      expect(Array.from(data), kind).toEqual(Array.from(vol[kind]));
    }
  });

  it('makes each data file’s uncompressed length size.x × size.y × size.z', () => {
    const h = readHeader();
    for (const kind of REGION_DATA_KINDS) {
      const data = gunzipSync(readFileSync(join(dir, 'out', h.files[kind].name)));
      expect(data.length).toBe(size.x * size.y * size.z);
      expect(h.files[kind].bytes).toBe(24);
    }
  });

  it('validator accepts the written header', () => {
    expect(validateRegionHeader(readHeader())).toEqual([]);
  });

  it('validator rejects a missing field', () => {
    for (const field of ['formatVersion', 'region', 'size', 'spacing', 'origin', 'orientation', 'files']) {
      const h = readHeader();
      delete h[field];
      expect(validateRegionHeader(h).join('\n'), field).toMatch(new RegExp(field));
    }
    const h = readHeader();
    delete h.files.levels;
    expect(validateRegionHeader(h).join('\n')).toMatch(/files\.levels is missing/);
  });

  it('validator rejects a non-positive spacing', () => {
    for (const bad of [0, -1]) {
      const h = readHeader();
      h.spacing.y = bad;
      expect(validateRegionHeader(h).join('\n')).toMatch(/spacing\.y must be above 0/);
    }
  });

  it('validator rejects a size that does not match the data length', () => {
    const h = readHeader();
    h.size.z = 3;
    expect(validateRegionHeader(h).join('\n')).toMatch(/files\.intensity\.bytes is 24 but size 4×3×3 needs 36/);
  });

  it('validator rejects a non-identity orientation', () => {
    const h = readHeader();
    h.orientation[0] = { x: -1, y: 0, z: 0 };
    expect(validateRegionHeader(h).join('\n')).toMatch(/orientation\[0\].*standard layout/);
  });

  it('validator rejects a region name with other characters', () => {
    for (const name of ['Lumbar', 'lumbar_1', '../evil', 'lum bar', '', '-lead']) {
      const h = readHeader();
      h.region = name;
      expect(validateRegionHeader(h).join('\n'), name).toMatch(/region must be a name/);
    }
    expect(() => writeRegion(join(dir, 'bad'), { ...vol, region: '../evil' })).toThrow(/lower-case letters/);
  });

  it('writer rejects data whose length does not match the size', () => {
    expect(() => writeRegion(join(dir, 'bad2'), { ...vol, labels: new Uint8Array(5) })).toThrow(/labels has 5 voxels/);
  });
});
