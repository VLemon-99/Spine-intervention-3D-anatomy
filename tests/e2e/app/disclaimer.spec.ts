import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';

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
