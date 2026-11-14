// F5-S9: depth, bevel clock face and angle to the beam (F5.6).
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { advanceNeedle, markEntryAtPixel, rotateBevel, setHubAngles, waitForVolume } from './needlePage';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
  await takeImage(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
});

test('after advancing 12.4 mm the depth readout shows 12.4', async ({ page }) => {
  const depth = page.getByTestId('needle-panel').getByTestId('needle-depth');
  await expect(depth).toHaveText('0.0');
  await advanceNeedle(page, 12.4);
  await expect(depth).toHaveText('12.4');
  await expect(depth).toBeVisible();
});

test('after rotating the bevel to 90° the clock face has data-angle 90 and the notch at 3 o\'clock', async ({ page }) => {
  const bevel = page.getByTestId('needle-panel').getByTestId('needle-bevel');
  await expect(bevel).toHaveAttribute('data-angle', '0');
  await rotateBevel(page, 90);
  await expect(bevel).toHaveAttribute('data-angle', '90');
  await expect(bevel).toBeVisible();
  const notch = page.getByTestId('needle-bevel-notch');
  expect(Number(await notch.getAttribute('cx'))).toBeGreaterThan(8);
  expect(Math.abs(Number(await notch.getAttribute('cy')))).toBeLessThan(0.01);
});

test('right after marking the beam angle shows 0; after a 10° hub change it shows 10', async ({ page }) => {
  const angle = page.getByTestId('needle-panel').getByTestId('needle-beam-angle');
  await expect(angle).toHaveText('0');
  await expect(angle).toBeVisible();
  await setHubAngles(page, 0, 10);
  await expect.poll(async () => Math.abs(Number(await angle.textContent()) - 10)).toBeLessThanOrEqual(1);
  await setHubAngles(page, 10, 0);
  await expect.poll(async () => Math.abs(Number(await angle.textContent()) - 10)).toBeLessThanOrEqual(1);
});
