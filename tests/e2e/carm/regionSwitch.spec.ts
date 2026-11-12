// F3-S10: the region picker lists the regions on offer and asks for the one the
// learner picks (F3.7, F1.6). F1's loader may not be merged, so the test fills
// store.regions, listens on the bus and puts a new volume in the store itself,
// through the dev server's store module (the same trick as setPose).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas, type PixelPosition } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';

const REGIONS = [
  { name: 'cervical', title: 'Cervical' },
  { name: 'lumbosacral', title: 'Lumbosacral' },
];

const GRID: PixelPosition[] = [];
for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) GRID.push({ x: 16 + i * 32, y: 16 + j * 32 });

type StoreModule = typeof import('../../../src/core/store');
const STORE_MODULE = '/src/core/store.ts';

/** Put the regions on offer in the store and start recording 'regionRequest' events in the page. */
async function offerRegions(page: Page): Promise<void> {
  await page.evaluate(
    async ({ regions, storeModule }) => {
      const { store, bus } = (await import(/* @vite-ignore */ storeModule)) as StoreModule;
      const w = window as unknown as { __regionRequests: string[] };
      w.__regionRequests = [];
      bus.on('regionRequest', (name) => w.__regionRequests.push(name));
      store.set({ regions });
    },
    { regions: REGIONS, storeModule: STORE_MODULE },
  );
}

const regionRequests = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __regionRequests: string[] }).__regionRequests);

/** Put a copy of the current volume in the store under another region name (as the anatomy loader would). */
async function loadVolumeNamed(page: Page, region: string): Promise<void> {
  await page.evaluate(
    async ({ region, storeModule }) => {
      const { store } = (await import(/* @vite-ignore */ storeModule)) as StoreModule;
      const volume = store.get().volume;
      if (!volume) throw new Error('no volume loaded');
      store.set({ volume: { ...volume, region } });
    },
    { region, storeModule: STORE_MODULE },
  );
}

const optionTexts = (page: Page): Promise<string[]> => page.getByTestId('region-picker').locator('option').allInnerTexts();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test("with two regions on offer, the picker shows both plus 'Phantom', and 'Phantom' is still selected", async ({
  page,
}) => {
  await offerRegions(page);
  await expect.poll(() => optionTexts(page)).toEqual(['Cervical', 'Lumbosacral', 'Phantom']);
  await expect(page.getByTestId('region-picker')).toHaveValue('phantom');
});

test("choosing a region emits exactly one 'regionRequest'; shot count and canvas are unchanged; a new volume then shows as selected", async ({
  page,
}) => {
  await takeImage(page);
  await page.waitForTimeout(200);
  const before = await getSimState(page);
  const canvasBefore = await readCanvas(page, GRID);
  await offerRegions(page);
  await expect.poll(() => optionTexts(page)).toEqual(['Cervical', 'Lumbosacral', 'Phantom']);

  await page.getByTestId('region-picker').selectOption('lumbosacral');
  await expect.poll(() => regionRequests(page)).toEqual(['lumbosacral']);
  await page.waitForTimeout(300);
  expect(await regionRequests(page)).toEqual(['lumbosacral']);
  // The picker keeps showing what is loaded until a new volume arrives.
  await expect(page.getByTestId('region-picker')).toHaveValue('phantom');
  const after = await getSimState(page);
  expect(after.shotCount).toBe(before.shotCount);
  expect(after.lastImagePose).toEqual(before.lastImagePose);
  await expect(page.getByTestId('shot-count')).toHaveText(String(before.shotCount));
  expect(await readCanvas(page, GRID)).toEqual(canvasBefore);

  // The anatomy zone would now load it; the test does that itself.
  await loadVolumeNamed(page, 'lumbosacral');
  await expect(page.getByTestId('region-picker')).toHaveValue('lumbosacral');
  await expect.poll(() => optionTexts(page)).toEqual(['Cervical', 'Lumbosacral']);
  expect(await regionRequests(page)).toEqual(['lumbosacral']);
});

test("picking the region that is already loaded emits no 'regionRequest'", async ({ page }) => {
  await offerRegions(page);
  await expect.poll(() => optionTexts(page)).toEqual(['Cervical', 'Lumbosacral', 'Phantom']);
  await page.getByTestId('region-picker').selectOption('phantom');
  await page.waitForTimeout(300);
  expect(await regionRequests(page)).toEqual([]);
});

test("the picker's touch area is at least 44 px tall", async ({ page }) => {
  await offerRegions(page);
  const box = await page.getByTestId('region-picker').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});
