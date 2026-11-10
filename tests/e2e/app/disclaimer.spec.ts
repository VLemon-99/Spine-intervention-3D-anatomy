import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows the disclaimer on load with the training-only wording', async ({ page }) => {
  const disclaimer = page.getByTestId('disclaimer');
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toContainText('For training only');
  await expect(disclaimer).toContainText('not for clinical use');
  await expect(page.getByTestId('disclaimer-accept')).toHaveText('I understand');
});

test('the disclaimer covers the whole viewport while shown', async ({ page }) => {
  const box = await page.getByTestId('disclaimer').boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeLessThanOrEqual(0);
  expect(box.y).toBeLessThanOrEqual(0);
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height);
});

test('clicking (desktop) or tapping (tablet) "I understand" hides the disclaimer', async ({ page }) => {
  await acceptDisclaimer(page);
  await expect(page.getByTestId('disclaimer')).toBeHidden();
});

test('reports whether the disclaimer is shown, for page-wide shortcuts', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-disclaimer', 'shown');
  await acceptDisclaimer(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-disclaimer', 'shown');
});

test('while shown, the keyboard cannot reach or use anything behind the disclaimer', async ({ page }) => {
  await getSimState(page);
  // Tab through the page several times, pressing Enter wherever focus lands.
  // Focus must stay inside the disclaimer (or on the page itself), and no image is taken.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const outside = await page.evaluate(() => {
      const active = document.activeElement;
      const overlay = document.querySelector('[data-testid="disclaimer"]');
      return active !== null && active !== document.body && !overlay?.contains(active);
    });
    expect(outside, `Tab ${i + 1} moved focus behind the disclaimer`).toBe(false);
    const onAccept = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.testid === 'disclaimer-accept',
    );
    if (!onAccept) await page.keyboard.press('Enter');
  }
  expect((await getSimState(page)).shotCount).toBe(0);
  await expect(page.getByTestId('disclaimer')).toBeVisible();
});

test('after accepting, the keyboard can reach the panels again', async ({ page }) => {
  await acceptDisclaimer(page);
  await page.getByTestId('shot-button').focus();
  await expect(page.getByTestId('shot-button')).toBeFocused();
});
