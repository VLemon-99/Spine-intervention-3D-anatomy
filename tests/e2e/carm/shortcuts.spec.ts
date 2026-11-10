// F3-S3: keyboard shortcuts step the pose (F3.2). Desktop set-up only: the
// tablet set-up has no keyboard and uses the sliders (tests/e2e/carm/sliders.spec.ts).
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';

test.describe('desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
  });

  test('L three times and Shift+I once give oblique +3 and tilt +5, without taking an image', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.keyboard.press('KeyL');
    await page.keyboard.press('KeyL');
    await page.keyboard.press('KeyL');
    await page.keyboard.press('Shift+KeyI');
    await expect.poll(async () => (await getSimState(page)).pose.tilt).toBe(5);
    const state = await getSimState(page);
    expect(state.pose).toEqual({ oblique: 3, tilt: 5, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
    await expect(page.getByTestId('readout-oblique')).toHaveText('3°');
    await expect(page.getByTestId('readout-tilt')).toHaveText('5°');
    expect(state.shotCount).toBe(0);
    expect(state.lastImagePose).toBeNull();
  });

  test('a table key steps 5 mm and its readout follows', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.keyboard.press('KeyY');
    await expect.poll(async () => (await getSimState(page)).pose.tableHeight).toBe(5);
    await expect(page.getByTestId('readout-table-height')).toHaveText('5 mm');
  });

  test('the keys do nothing while the disclaimer is shown', async ({ page }) => {
    await expect(page.getByTestId('disclaimer')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const key of ['KeyJ', 'KeyL', 'KeyI', 'KeyK', 'KeyN', 'KeyM', 'KeyU', 'KeyO', 'KeyY', 'KeyH']) {
      await page.keyboard.press(key);
      await page.keyboard.press(`Shift+${key}`);
    }
    await page.waitForTimeout(200);
    const state = await getSimState(page);
    expect(state.pose).toEqual({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
    await expect(page.getByTestId('disclaimer')).toBeVisible();
  });
});
