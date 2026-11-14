// F5-S4: the Mark entry tool, driven by the 'imageTap' bus event (F5.2, F5.3).
// The render zone emits imageTap from the canvas (F7-S7); here the tests emit
// it themselves through the dev server's store module.
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import {
  advanceNeedle,
  emitImageTap,
  markEntryAtPixel,
  readNeedle,
  waitForVolume,
  withdrawFully,
} from './needlePage';

async function press(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId);
  if (test.info().project.use.hasTouch) await button.tap();
  else await button.click();
}

const tool = (page: Page) => page.getByTestId('needle-panel').getByTestId('mark-entry');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
});

test('Mark entry is disabled before the first image', async ({ page }) => {
  await expect(tool(page)).toBeVisible();
  await expect(tool(page)).toBeDisabled();
  await emitImageTap(page, { x: 256, y: 256 });
  expect(await readNeedle(page)).toBeNull();
  await takeImage(page);
  await expect(tool(page)).toBeEnabled();
});

test('with Mark entry on, imageTap marks the same entry as markEntryAtPixel and the tool switches off', async ({ page }) => {
  await takeImage(page);
  await press(page, 'mark-entry');
  await expect(tool(page)).toHaveAttribute('aria-pressed', 'true');
  await emitImageTap(page, { x: 256, y: 256 });
  const tapped = await readNeedle(page);
  if (!tapped) throw new Error('imageTap marked no entry');
  await expect(tool(page)).toHaveAttribute('aria-pressed', 'false');

  await withdrawFully(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  expect((await readNeedle(page))?.entryPoint).toEqual(tapped.entryPoint);
});

test('with Mark entry off, imageTap changes nothing', async ({ page }) => {
  await takeImage(page);
  await expect(tool(page)).toHaveAttribute('aria-pressed', 'false');
  await emitImageTap(page, { x: 256, y: 256 });
  expect(await readNeedle(page)).toBeNull();

  // Off again after switching on and off.
  await press(page, 'mark-entry');
  await press(page, 'mark-entry');
  await emitImageTap(page, { x: 256, y: 256 });
  expect(await readNeedle(page)).toBeNull();
});

test('after marking and advancing 1 mm Mark entry is disabled and imageTap changes nothing; Withdraw fully enables it again', async ({ page }) => {
  await takeImage(page);
  await press(page, 'mark-entry');
  await emitImageTap(page, { x: 256, y: 256 });
  expect(await advanceNeedle(page, 1)).toBe('ok');
  await expect(tool(page)).toBeDisabled();
  const before = await readNeedle(page);
  await emitImageTap(page, { x: 230, y: 240 });
  expect(await readNeedle(page)).toEqual(before);

  await press(page, 'needle-withdraw-all');
  await expect(tool(page)).toBeEnabled();
});

test.describe('tablet sizes', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');
  test('the Mark entry button is at least 44×44 px', async ({ page }) => {
    const box = await tool(page).boundingBox();
    if (!box) throw new Error('no box');
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
