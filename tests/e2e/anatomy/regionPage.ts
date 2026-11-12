// Anatomy zone screen-test helper (not a spec file). Builds a tiny region file set
// and manifest in the test process with the F1-S8 writer, serves them under data/
// with page.route (nothing is added to public/data/), and calls the loader in the
// page through the dev server's module (the same trick tests/fixtures/simPage.ts
// uses for the store).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { landmarksFileName, type Manifest } from '../../../src/anatomy/manifestFormat';
import { dataFileName, headerFileName, REGION_DATA_KINDS } from '../../../src/anatomy/regionFormat';
import { LEVEL_IDS, TISSUE } from '../../../src/core/labels';
import { writeRegion } from '../../../tools/anatomy/writeRegion';

export interface TinyRegion {
  name: string;
  size: { x: number; y: number; z: number };
  /** File name → bytes, as served under data/. */
  files: Map<string, Buffer>;
}

/**
 * A tiny lumbosacral region: a 24 × 24 × 24 grid of 2 mm voxels centred on the
 * isocentre, muscle with a dense bone block in the middle (labelled L4).
 */
export function buildTinyRegion(name = 'lumbosacral'): TinyRegion {
  const n = 24;
  const size = { x: n, y: n, z: n };
  const count = n ** 3;
  const intensity = new Uint8Array(count).fill(90);
  const labels = new Uint8Array(count).fill(TISSUE.muscle);
  const levels = new Uint8Array(count);
  for (let k = 8; k < 16; k++)
    for (let j = 8; j < 16; j++)
      for (let i = 8; i < 16; i++) {
        const v = i + n * (j + n * k);
        intensity[v] = 240;
        labels[v] = TISSUE.corticalBone;
        levels[v] = LEVEL_IDS.L4;
      }
  const dir = mkdtempSync(join(tmpdir(), 'tiny-region-'));
  try {
    const spacing = { x: 2, y: 2, z: 2 };
    const origin = { x: -23, y: -23, z: -23 };
    writeRegion(dir, { region: name, size, spacing, origin, intensity, labels, levels });
    writeFileSync(join(dir, landmarksFileName(name)), JSON.stringify({ reviewedByOwner: false, region: name, levels: [] }));
    const manifest: Manifest = {
      formatVersion: 1,
      regions: [
        {
          name: name as Manifest['regions'][number]['name'],
          title: 'Lumbosacral (L1–sacrum)',
          levels: ['L4'],
          files: {
            header: headerFileName(name),
            intensity: dataFileName(name, 'intensity'),
            labels: dataFileName(name, 'labels'),
            levels: dataFileName(name, 'levels'),
            landmarks: landmarksFileName(name),
          },
          size,
          spacing,
          sourceDataset: 'Generated screen-test fixture',
          licence: 'CC0 (test data)',
          attribution: 'Made up for a screen test',
        },
      ],
    };
    const files = new Map<string, Buffer>();
    for (const file of [headerFileName(name), landmarksFileName(name), ...REGION_DATA_KINDS.map((k) => dataFileName(name, k))]) {
      files.set(file, readFileSync(join(dir, file)));
    }
    files.set('manifest.json', Buffer.from(JSON.stringify(manifest)));
    return { name, size, files };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Serves the region's files (and its manifest) at data/<file>. Call before the page asks for them. */
export async function serveRegion(page: Page, region: TinyRegion): Promise<void> {
  await page.route('**/data/*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const body = region.files.get(file);
    if (!body) return route.fulfill({ status: 404, body: 'not found' });
    const type = file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    return route.fulfill({ status: 200, body, contentType: type });
  });
}

const LOADER = '/src/anatomy/loadRegion.ts';
const STORE = '/src/core/store.ts';

/** listRegions() in the page. */
export async function listRegionsInPage(page: Page): Promise<{ name: string; title: string }[]> {
  return page.evaluate(async (loader) => {
    const mod = (await import(/* @vite-ignore */ loader)) as typeof import('../../../src/anatomy/loadRegion');
    return mod.listRegions();
  }, LOADER);
}

/** loadRegion(name) in the page; returns the size, or the error message if it was rejected. */
export async function loadRegionInPage(
  page: Page,
  name: string,
  options: { putInStore?: boolean } = {},
): Promise<{ size?: { x: number; y: number; z: number }; region?: string; error?: string }> {
  return page.evaluate(
    async ({ loader, store, name, putInStore }) => {
      const mod = (await import(/* @vite-ignore */ loader)) as typeof import('../../../src/anatomy/loadRegion');
      try {
        const { volume, landmarks } = await mod.loadRegion(name);
        if (putInStore) {
          const s = (await import(/* @vite-ignore */ store)) as typeof import('../../../src/core/store');
          s.store.set({ volume, landmarks });
        }
        return { size: volume.size, region: volume.region };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    { loader: LOADER, store: STORE, name, putInStore: options.putInStore ?? false },
  );
}
