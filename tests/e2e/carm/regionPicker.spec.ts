// F3-S9: the region picker shows the loaded region; 'Phantom' on the phantom-only build (F3.7).
import { expect, test } from '@playwright/test';
import type { SimHook } from '../../../src/core/testHook';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test("the region picker is in the C-arm panel with exactly one option, 'Phantom', selected", async ({ page }) => {
  const picker = page.getByTestId('carm-panel').getByTestId('region-picker');
  await expect(picker).toBeVisible();
  const options = picker.locator('option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveText('Phantom');
  await expect(picker).toHaveValue('phantom');
  expect(await picker.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent)).toBe('Phantom');

  // Visible without scrolling and inside the panel (the panel hides overflow).
  const box = await picker.boundingBox();
  const panel = await page.getByTestId('carm-panel').boundingBox();
  const viewport = page.viewportSize();
  if (!box || !panel || !viewport) throw new Error('missing box');
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(viewport.height, panel.y + panel.height));
  expect(box.x + box.width).toBeLessThanOrEqual(Math.min(viewport.width, panel.x + panel.width));
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});

test("window.__sim.getState().volume.region is 'phantom'", async ({ page }) => {
  await getSimState(page); // waits for the test hook
  const region = await page.evaluate(() => (window as unknown as { __sim: SimHook }).__sim.getState().volume?.region);
  expect(region).toBe('phantom');
});
