import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { buildTinyRegion, listRegionsInPage, loadRegionInPage, serveRegion } from './regionPage';

const SAMPLE = [
  { x: 0, y: 0 },
  { x: 511, y: 511 },
  { x: 256, y: 256 },
  { x: 200, y: 300 },
];

type VolumeState = { volume: { region: string; size: { x: number; y: number; z: number } } | null };

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
}

test('a region served by page.route loads, shows in window.__sim and is drawn on the next image', async ({ page }) => {
  const region = buildTinyRegion();
  await serveRegion(page, region);
  await open(page);

  const result = await loadRegionInPage(page, region.name, { putInStore: true });
  expect(result.error).toBeUndefined();
  expect(result.size).toEqual(region.size);

  const state = (await getSimState(page)) as unknown as VolumeState;
  expect(state.volume).toEqual({ region: 'lumbosacral', size: region.size });

  const blank = await readCanvas(page, SAMPLE);
  await takeImage(page);
  await expect.poll(() => readCanvas(page, SAMPLE)).not.toEqual(blank);
});

test('with the committed empty manifest, listRegions() returns an empty list', async ({ page }) => {
  await open(page);
  expect(await listRegionsInPage(page)).toEqual([]);
});

test('loadRegion for a name the served manifest does not list is rejected with a clear message', async ({ page }) => {
  await serveRegion(page, buildTinyRegion());
  await open(page);
  const result = await loadRegionInPage(page, 'cervical');
  expect(result.error).toMatch(/"cervical" is not listed in manifest\.json/);
  const state = (await getSimState(page)) as unknown as VolumeState;
  expect(state.volume?.region).toBe('phantom');
});
