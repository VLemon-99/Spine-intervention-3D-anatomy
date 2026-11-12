// F8.5: in Exam mode the 3D view is hidden and its toggle is disabled.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { getView3d, setMode } from './view3dPage';

const LAYER_TOGGLES = ['nerves', 'vessels', 'thecal', 'soft'].map((id) => `layer-toggle-${id}`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

/** Click (desktop) or tap (tablet) the toggle even when it is disabled, as a learner would try to. */
async function tryToggle(page: import('@playwright/test').Page): Promise<void> {
  const toggle = page.getByTestId('view3d-toggle');
  if (test.info().project.use.hasTouch) {
    await toggle.tap({ force: true });
  } else {
    await toggle.click({ force: true });
  }
}

test('with the view on, Exam mode hides it and disables the toggle', async ({ page }) => {
  await tryToggle(page);
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
  expect((await getView3d(page)).shown).toBe(true);

  await setMode(page, 'exam');
  await expect(page.getByTestId('view3d-canvas')).toBeHidden();
  for (const id of LAYER_TOGGLES) await expect(page.getByTestId(id)).toBeHidden();
  await expect(page.getByTestId('view3d-toggle')).toBeDisabled();
  const info = await getView3d(page);
  expect(info.shown).toBe(false);
  expect(info.toggleEnabled).toBe(false);
});

test('in Exam mode a click or tap on the toggle does not show the view', async ({ page }) => {
  await setMode(page, 'exam');
  await expect(page.getByTestId('view3d-toggle')).toBeDisabled();
  await tryToggle(page);
  await tryToggle(page);
  await expect(page.getByTestId('view3d-canvas')).toBeHidden();
  const info = await getView3d(page);
  expect(info.shown).toBe(false);
  expect(info.toggleEnabled).toBe(false);
});

test('back in Practice mode the toggle works again, starting from off', async ({ page }) => {
  await tryToggle(page);
  await setMode(page, 'exam');
  await expect(page.getByTestId('view3d-toggle')).toBeDisabled();

  await setMode(page, 'practice');
  await expect(page.getByTestId('view3d-toggle')).toBeEnabled();
  let info = await getView3d(page);
  expect(info.toggleEnabled).toBe(true);
  // Owner decision 2026-11-11: the view stays off until the learner turns it on.
  expect(info.shown).toBe(false);
  await expect(page.getByTestId('view3d-canvas')).toBeHidden();

  await tryToggle(page);
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
  info = await getView3d(page);
  expect(info.shown).toBe(true);
  for (const id of LAYER_TOGGLES) await expect(page.getByTestId(id)).toBeVisible();
});
