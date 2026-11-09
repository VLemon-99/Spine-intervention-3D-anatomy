import { expect, test, type Page } from '@playwright/test';
import type { SimHook } from '../../../src/core/testHook';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';

type HookState = ReturnType<SimHook['getState']>;

async function getState(page: Page): Promise<HookState> {
  await page.waitForFunction(() => 'getState' in ((window as { __sim?: object }).__sim ?? {}));
  return page.evaluate(() => (window as unknown as { __sim: SimHook }).__sim.getState());
}

const shotCount = async (page: Page): Promise<number> => (await getState(page)).shotCount;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getState(page); // wait for the test hook
});

test.describe('desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test('one spacebar press takes one image of the current pose', async ({ page }) => {
    await acceptDisclaimer(page);
    expect(await shotCount(page)).toBe(0);
    await page.keyboard.press('Space');
    await expect.poll(() => shotCount(page)).toBe(1);
    const state = await getState(page);
    expect(state.lastImagePose).toEqual(state.pose);
  });

  test('the spacebar does nothing while the disclaimer is shown', async ({ page }) => {
    await expect(page.getByTestId('disclaimer')).toBeVisible();
    // Move focus away from the 'I understand' button so the key cannot dismiss it.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    expect(await shotCount(page)).toBe(0);
    await expect(page.getByTestId('disclaimer')).toBeVisible();
  });

  test('with the Shot button focused, one spacebar press takes exactly one image', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.getByTestId('shot-button').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    expect(await shotCount(page)).toBe(1);
  });

  test('the spacebar does not scroll the page', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 0);
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('one click on Shot takes exactly one image', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.getByTestId('shot-button').click();
    await page.waitForTimeout(200);
    expect(await shotCount(page)).toBe(1);
  });
});

test.describe('tablet', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');

  test('one tap on Shot takes exactly one image', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.getByTestId('shot-button').tap();
    await page.waitForTimeout(200);
    expect(await shotCount(page)).toBe(1);
  });
});
