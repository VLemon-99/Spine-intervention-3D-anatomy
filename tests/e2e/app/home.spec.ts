import { expect, test, type Page } from '@playwright/test';
import { getSimState, takeImage } from '../../fixtures/simPage';
import type { Mode } from '../../../src/core/types';

// F12.2: after the disclaimer, the app shows the home screen; Free play opens
// the simulator screen, whose Home button goes back.
const PANELS = ['fluoro-panel', 'carm-panel', 'needle-panel', 'view3d-panel'];
const CHOICES: [string, string][] = [
  ['home-practice', 'Practice'],
  ['home-exam', 'Exam'],
  ['home-quiz', 'Quiz'],
  ['home-freeplay', 'Free play'],
  ['home-history', 'History'],
  ['home-about', 'About'],
];

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string): Promise<void> {
  const button = page.getByTestId(testid);
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
}

/** Read or set the mode through the dev server's store module (the app's own instance). */
async function getMode(page: Page): Promise<Mode> {
  return page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    return store.get().mode;
  });
}
async function setMode(page: Page, mode: Mode): Promise<void> {
  await page.evaluate(async (next) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ mode: next });
  }, mode);
}

async function expectAtLeast44(page: Page, testid: string): Promise<void> {
  const box = await page.getByTestId(testid).boundingBox();
  expect(box, `${testid} has no box`).not.toBeNull();
  if (!box) return;
  expect(box.width, `${testid} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${testid} height`).toBeGreaterThanOrEqual(44);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await press(page, 'disclaimer-accept');
  await expect(page.getByTestId('disclaimer')).toBeHidden();
});

test('after "I understand", the home screen shows the choices and the panels are not visible', async ({ page }) => {
  await expect(page.getByTestId('home-screen')).toBeVisible();
  for (const [testid, label] of CHOICES) {
    await expect(page.getByTestId(testid)).toBeVisible();
    await expect(page.getByTestId(testid)).toHaveText(label);
  }
  for (const panel of PANELS) {
    await expect(page.getByTestId(panel)).toBeHidden();
  }
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'home');
});

test('Free play shows the four panels, sets the mode to freeplay and data-screen to sim', async ({ page }) => {
  await setMode(page, 'practice');
  await press(page, 'home-freeplay');
  for (const panel of PANELS) {
    await expect(page.getByTestId(panel)).toBeVisible();
  }
  await expect(page.getByTestId('home-screen')).toBeHidden();
  expect(await getMode(page)).toBe('freeplay');
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'sim');
});

test('the Home button returns to the home screen without changing the pose or the shot count', async ({ page }) => {
  await press(page, 'home-freeplay');
  await takeImage(page);
  const before = await getSimState(page);
  await press(page, 'home-button');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'home');
  for (const panel of PANELS) {
    await expect(page.getByTestId(panel)).toBeHidden();
  }
  const after = await getSimState(page);
  expect(after.shotCount).toBe(before.shotCount);
  expect(after.pose).toEqual(before.pose);
});

test('with the top bar, the four panels still fit without scrolling', async ({ page }) => {
  await press(page, 'home-freeplay');
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  for (const panel of PANELS) {
    const box = await page.getByTestId(panel).boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.y + box.height, `${panel} bottom`).toBeLessThanOrEqual(viewport.height);
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scroll).toBeLessThanOrEqual(viewport.height);
});

test("the home screen's buttons and the Home button are at least 44×44 px", async ({ page }) => {
  for (const [testid] of CHOICES) await expectAtLeast44(page, testid);
  await press(page, 'home-freeplay');
  await expectAtLeast44(page, 'home-button');
});
