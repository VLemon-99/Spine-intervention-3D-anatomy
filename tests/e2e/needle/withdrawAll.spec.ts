// F5-S13: Withdraw fully (F5.6) and the needle lock (F5.1).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { advanceNeedle, markEntryAtPixel, readNeedle, waitForVolume } from './needlePage';

async function press(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId);
  if (test.info().project.use.hasTouch) await button.tap();
  else await button.click();
}

/** A pick that ignores the disabled state, to check the session itself refuses it. */
async function forcePick(page: Page, testId: string, value: string): Promise<void> {
  await page.getByTestId(testId).evaluate((el: HTMLSelectElement, v) => {
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
  await takeImage(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  expect(await advanceNeedle(page, 5)).toBe('ok');
});

test('Withdraw fully removes the needle and unlocks the needle picker', async ({ page }) => {
  await expect(page.getByTestId('needle-select')).toBeDisabled();
  await press(page, 'needle-withdraw-all');
  await expect.poll(() => readNeedle(page)).toBeNull();
  await expect(page.getByTestId('needle-select')).toBeEnabled();
  await expect(page.getByTestId('prebend-select')).toBeEnabled();
  await expect(page.getByTestId('needle-withdraw-all')).toBeDisabled();
});

test('while inserted the pickers are disabled and picking does not change the needle', async ({ page }) => {
  await expect(page.getByTestId('needle-select')).toBeDisabled();
  await expect(page.getByTestId('prebend-select')).toBeDisabled();
  const before = await readNeedle(page);
  expect(before?.locked).toBe(true);
  await forcePick(page, 'needle-select', 'tuohy-20g-89');
  await forcePick(page, 'prebend-select', '20');
  const after = await readNeedle(page);
  expect(after?.needleId).toBe(before?.needleId);
  expect(after?.preBend).toBe(before?.preBend);
  // The pickers go back to showing the needle in use.
  await expect(page.getByTestId('needle-select')).toHaveValue(before!.needleId);
  await expect(page.getByTestId('prebend-select')).toHaveValue(String(before!.preBend));
});

test.describe('tablet sizes', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');
  test('Withdraw fully is at least 44×44 px', async ({ page }) => {
    const box = await page.getByTestId('needle-withdraw-all').boundingBox();
    if (!box) throw new Error('no box');
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
