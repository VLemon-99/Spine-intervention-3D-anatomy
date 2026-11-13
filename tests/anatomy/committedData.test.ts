import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import { checkDataFolder } from '../../tools/anatomy/checkData';
import { runConvertCli } from '../../tools/anatomy/convertCore';
import { writeNiftiFolder } from './niftiFolderFixture';

const PUBLIC_DATA = fileURLToPath(new URL('../../public/data/', import.meta.url));

describe('committed anatomy files (public/data)', () => {
  it('pass every check (today: the empty manifest)', () => {
    expect(checkDataFolder(PUBLIC_DATA)).toEqual([]);
  });
});

describe('the data checks on a converted fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-data-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const input = writeNiftiFolder(join(root, 'in'), createPhantom());
  const good = join(root, 'good');
  mkdirSync(good);
  const code = runConvertCli([input, good], { log: () => {}, error: (t) => console.error(t) });

  /** A fresh copy of the good output to break. */
  const copy = (name: string) => {
    const dir = join(root, name);
    cpSync(good, dir, { recursive: true });
    return dir;
  };

  it('pass on a region converted from the generated fixture', () => {
    expect(code).toBe(0);
    expect(checkDataFolder(good)).toEqual([]);
  });

  it('fail when a data file is deleted', () => {
    const dir = copy('deleted');
    rmSync(join(dir, 'lumbosacral.levels.bin.gz'));
    expect(checkDataFolder(dir).join('\n')).toMatch(/lumbosacral\.levels\.bin\.gz \(levels\) is missing/);
  });

  it('fail when a landmark’s body centre is moved into soft tissue', () => {
    const dir = copy('moved');
    const path = join(dir, 'lumbosacral.landmarks.json');
    const lm = JSON.parse(readFileSync(path, 'utf8'));
    lm.levels[0].bodyCentre = { x: 0, y: 35, z: 0 }; // in the muscle behind the spine
    writeFileSync(path, JSON.stringify(lm));
    expect(checkDataFolder(dir).join('\n')).toMatch(/L4 body centre is not in bone/);
  });

  it('fail when the size limit (lowered for the test) is exceeded', () => {
    expect(checkDataFolder(good, { maxRegionBytes: 1000 }).join('\n')).toMatch(/more than the 0\.00 MB limit/);
    expect(checkDataFolder(good, { maxTotalBytes: 1000 }).join('\n')).toMatch(/All regions together/);
  });

  it('fail when a data file unpacks to the wrong length', () => {
    const dir = copy('short');
    writeFileSync(join(dir, 'lumbosacral.labels.bin.gz'), Buffer.alloc(7));
    expect(checkDataFolder(dir).join('\n')).toMatch(/labels data unpacks to 7 bytes/);
  });
});
