// F3-S4: the help overlay lists every keyboard shortcut (F3.2).
import { expect, test, type Page } from '@playwright/test';
import { POSE_KEYS } from '../../../src/carm/keymap';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testId: string): Promise<void> {
  const target = page.getByTestId(testId);
  if (test.info().project.use.hasTouch) await target.tap();
  else await target.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
});

test.describe('desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test('? shows the overlay and ? again hides it; ? then Escape also hides it', async ({ page }) => {
    await acceptDisclaimer(page);
    const overlay = page.getByTestId('help-overlay');
    await expect(overlay).toBeHidden();
    await page.keyboard.press('?');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('?');
    await expect(overlay).toBeHidden();
    await page.keyboard.press('?');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('the ? key does nothing while the disclaimer is shown', async ({ page }) => {
    await expect(page.getByTestId('disclaimer')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('?');
    await page.waitForTimeout(200);
    await expect(page.getByTestId('help-overlay')).toBeHidden();
  });

  test('while the overlay is open, the pose keys and the spacebar still work', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.keyboard.press('?');
    await expect(page.getByTestId('help-overlay')).toBeVisible();
    await page.keyboard.press('KeyL');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await getSimState(page)).shotCount).toBe(1);
    expect((await getSimState(page)).pose.oblique).toBe(1);
  });
});

test('the ? button shows the overlay and the Close button hides it', async ({ page }) => {
  await acceptDisclaimer(page);
  const overlay = page.getByTestId('help-overlay');
  await expect(overlay).toBeHidden();
  await press(page, 'help-button');
  await expect(overlay).toBeVisible();
  await press(page, 'help-close');
  await expect(overlay).toBeHidden();
});

test('the overlay names every pose key and also Space, F and ?', async ({ page }) => {
  await acceptDisclaimer(page);
  await press(page, 'help-button');
  const overlay = page.getByTestId('help-overlay');
  await expect(overlay).toBeVisible();
  const keys = await overlay.locator('kbd').allInnerTexts();
  const named = new Set(keys.flatMap((k) => k.split(/\s*[/+]\s*|\s+/)).filter(Boolean));
  for (const key of POSE_KEYS) expect(named, key.label).toContain(key.label);
  for (const key of ['Space', 'F', '?', 'Shift']) expect(named, key).toContain(key);
  await expect(overlay.getByTestId('help-group').filter({ has: page.getByRole('heading', { name: 'C-arm' }) })).toHaveCount(1);
});

test('a group registered through the shared shortcuts module appears under its own heading', async ({ page }) => {
  await acceptDisclaimer(page);
  await press(page, 'help-button');
  await page.evaluate(async () => {
    const shortcutsModule = '/src/core/shortcuts.ts';
    const { shortcuts } = (await import(/* @vite-ignore */ shortcutsModule)) as typeof import('../../../src/core/shortcuts');
    shortcuts.register('Test needle', [{ keys: 'W / S', action: 'Advance / withdraw (test entry)' }]);
  });
  const group = page.getByTestId('help-group').filter({ has: page.getByRole('heading', { name: 'Test needle' }) });
  await expect(group).toHaveCount(1);
  await expect(group).toContainText('W / S');
  await expect(group).toContainText('Advance / withdraw (test entry)');
  // The C-arm group is still there.
  await expect(page.getByTestId('help-group').filter({ has: page.getByRole('heading', { name: 'C-arm', exact: true }) })).toHaveCount(1);
});

test('the ? button is at least 44×44 px', async ({ page }) => {
  await acceptDisclaimer(page);
  const box = await page.getByTestId('help-button').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await press(page, 'help-button');
  const close = await page.getByTestId('help-close').boundingBox();
  expect(close).not.toBeNull();
  if (!close) return;
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);
});
