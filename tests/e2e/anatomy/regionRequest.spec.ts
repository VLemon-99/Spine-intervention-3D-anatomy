import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { anatomyStatus, buildTinyRegion, regionsInStore, requestRegion, serveRegion } from './regionPage';

type VolumeState = { volume: { region: string; size: { x: number; y: number; z: number } } | null };
const volumeOf = async (page: Page) => ((await getSimState(page)) as unknown as VolumeState).volume;

const SAMPLE = Array.from({ length: 16 }, (_, n) => ({ x: 32 + (n % 4) * 128, y: 32 + Math.floor(n / 4) * 128 }));

async function open(page: Page) {
  const manifestAnswered = page.waitForResponse((r) => r.url().endsWith('/data/manifest.json'));
  await page.goto('/');
  await getSimState(page);
  await manifestAnswered;
  await acceptDisclaimer(page);
}

test('with a tiny manifest served, store.regions lists one entry per manifest region', async ({ page }) => {
  await serveRegion(page, buildTinyRegion());
  await open(page);
  await expect.poll(() => regionsInStore(page)).toEqual([{ name: 'lumbosacral', title: 'Lumbosacral' }]);
});

test('a regionRequest for a listed region loads it; the canvas changes only on the next image', async ({ page }) => {
  const region = buildTinyRegion();
  await serveRegion(page, region);
  await open(page);
  await expect.poll(() => regionsInStore(page)).toHaveLength(1);

  await takeImage(page);
  const phantomImage = await readCanvas(page, SAMPLE);

  await requestRegion(page, 'lumbosacral');
  await expect.poll(() => volumeOf(page)).toEqual({ region: 'lumbosacral', size: region.size });
  expect((await anatomyStatus(page)).lastError).toBeNull();
  // Loading does not take an image: the phantom's image stays on screen.
  expect(await readCanvas(page, SAMPLE)).toEqual(phantomImage);

  await takeImage(page);
  await expect.poll(() => readCanvas(page, SAMPLE)).not.toEqual(phantomImage);
});

test('a regionRequest for an unlisted name changes nothing', async ({ page }) => {
  await serveRegion(page, buildTinyRegion());
  await open(page);
  await expect.poll(() => regionsInStore(page)).toHaveLength(1);
  await requestRegion(page, 'cervical');
  await requestRegion(page, '../../etc');
  expect(await anatomyStatus(page)).toEqual({ loading: false, lastError: null });
  expect((await volumeOf(page))?.region).toBe('phantom');
});

test('a regionRequest whose data file is broken keeps the phantom and reports the error', async ({ page }) => {
  const region = buildTinyRegion();
  region.files.set('lumbosacral.labels.bin.gz', gzipSync(Buffer.alloc(10)));
  await serveRegion(page, region);
  await open(page);
  await expect.poll(() => regionsInStore(page)).toHaveLength(1);
  await requestRegion(page, 'lumbosacral');
  await expect.poll(async () => (await anatomyStatus(page)).lastError).toMatch(/labels data has 10 bytes/);
  expect((await anatomyStatus(page)).loading).toBe(false);
  expect((await volumeOf(page))?.region).toBe('phantom');
});

test('with the committed empty manifest, store.regions stays empty and the volume stays the phantom', async ({ page }) => {
  await open(page);
  expect(await regionsInStore(page)).toEqual([]);
  expect((await anatomyStatus(page)).lastError).toBeNull();
  expect((await volumeOf(page))?.region).toBe('phantom');
});
