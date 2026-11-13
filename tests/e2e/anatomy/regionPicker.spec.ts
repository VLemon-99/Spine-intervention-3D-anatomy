// F1-S27 (SPEC F1.6, F3.7): choosing a region in the C-arm panel's region picker loads it.
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { anatomyStatus, buildTinyRegion, serveRegion } from './regionPage';

type VolumeState = { volume: { region: string; size: { x: number; y: number; z: number } } | null };
const volumeOf = async (page: Page) => ((await getSimState(page)) as unknown as VolumeState).volume;

const SAMPLE = Array.from({ length: 16 }, (_, n) => ({ x: 32 + (n % 4) * 128, y: 32 + Math.floor(n / 4) * 128 }));

test('choosing a region in the region picker loads it, and the next image shows it', async ({ page }) => {
  const region = buildTinyRegion();
  await serveRegion(page, region);
  const manifestAnswered = page.waitForResponse((r) => r.url().endsWith('/data/manifest.json'));
  await page.goto('/');
  await getSimState(page);
  await manifestAnswered;
  await acceptDisclaimer(page);

  const picker = page.getByTestId('carm-panel').getByTestId('region-picker');
  // The served manifest's region appears next to the phantom that is loaded at start.
  await expect(picker.locator('option[value="lumbosacral"]')).toHaveText('Lumbosacral');
  await expect(picker).toHaveValue('phantom');

  await takeImage(page);
  const phantomImage = await readCanvas(page, SAMPLE);

  if (test.info().project.use.hasTouch) await picker.tap();
  await picker.selectOption('lumbosacral');

  await expect.poll(() => volumeOf(page)).toEqual({ region: 'lumbosacral', size: region.size });
  expect((await anatomyStatus(page)).lastError).toBeNull();
  await expect(picker).toHaveValue('lumbosacral');

  await takeImage(page);
  await expect.poll(() => readCanvas(page, SAMPLE)).not.toEqual(phantomImage);
});
