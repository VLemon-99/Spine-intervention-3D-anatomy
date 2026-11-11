import { expect, test, type Page } from '@playwright/test';
import { getSimState, takeImage } from '../../fixtures/simPage';

// F12.1: an accepted disclaimer is remembered in the browser's local storage.
// These tests click or tap 'I understand' directly (not through the shared
// fixture, which skips a disclaimer that is not shown).

async function pressAccept(page: Page): Promise<void> {
  const button = page.getByTestId('disclaimer-accept');
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
  await expect(page.getByTestId('disclaimer')).toBeHidden();
}

/** Make window.localStorage throw, as when the browser blocks storage. */
async function blockStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
}

test('in a fresh browser context (nothing saved) the disclaimer is shown', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-disclaimer', 'shown');
});

test('after accepting and reloading, the disclaimer is not shown and <html> has no data-disclaimer', async ({
  page,
}) => {
  await page.goto('/');
  await pressAccept(page);
  await page.reload();
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  await expect(page.getByTestId('disclaimer')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-disclaimer');
  await expect(page.getByTestId('fluoro-panel')).toBeVisible();
});

test('with local storage blocked, the disclaimer is shown again after a reload and the app still works', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await blockStorage(page);
  await page.goto('/');
  await pressAccept(page);
  await page.reload();
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-disclaimer', 'shown');

  await pressAccept(page);
  expect((await getSimState(page)).shotCount).toBe(0);
  await takeImage(page);
  expect((await getSimState(page)).shotCount).toBe(1);
  expect(errors).toEqual([]);
});
