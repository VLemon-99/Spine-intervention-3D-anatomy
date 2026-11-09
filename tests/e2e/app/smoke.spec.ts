import { expect, test } from '@playwright/test';

test('the page title is "Spine Fluoro Trainer"', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page).toHaveTitle('Spine Fluoro Trainer');
});

test('a WebGL2 context can be created in the page', async ({ page }) => {
  await page.goto('/');
  const hasWebgl2 = await page.evaluate(
    () => document.createElement('canvas').getContext('webgl2') !== null,
  );
  expect(hasWebgl2).toBe(true);
});
