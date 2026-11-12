import { expect, test, type Page } from '@playwright/test';
import type { Mode } from '../../../src/core/types';

// F12.2: Practice and Exam open the procedure picker, Quiz opens the quiz
// screen; each sets the store's mode when chosen and has the Home button.

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string): Promise<void> {
  const button = page.getByTestId(testid);
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
}

/** Read the mode through the dev server's store module (the app's own instance). */
async function getMode(page: Page): Promise<Mode> {
  return page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    return store.get().mode;
  });
}

async function expectAtLeast44(page: Page, testid: string): Promise<void> {
  const box = await page.getByTestId(testid).boundingBox();
  expect(box, `${testid} has no box`).not.toBeNull();
  if (!box) return;
  expect(box.width, `${testid} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${testid} height`).toBeGreaterThanOrEqual(44);
}

async function backHome(page: Page): Promise<void> {
  await press(page, 'home-button');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'home');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await press(page, 'disclaimer-accept');
  await expect(page.getByTestId('home-screen')).toBeVisible();
});

for (const [testid, heading, mode] of [
  ['home-practice', 'Practice', 'practice'],
  ['home-exam', 'Exam', 'exam'],
] as const) {
  test(`${heading} shows the picker headed '${heading}' with the empty-list text and sets the mode to '${mode}'`, async ({
    page,
  }) => {
    await press(page, testid);
    const picker = page.getByTestId('procedure-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByTestId('procedure-picker-empty')).toHaveText('No procedures available yet');
    await expect(page.getByTestId('home-screen')).toBeHidden();
    await expect(page.getByTestId('fluoro-panel')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-screen', 'procedures');
    expect(await getMode(page)).toBe(mode);
    await backHome(page);
  });
}

test("Quiz shows the quiz screen with the quiz zone's marker and sets the mode to 'quiz'", async ({ page }) => {
  await press(page, 'home-quiz');
  const quiz = page.getByTestId('quiz-screen');
  await expect(quiz).toBeVisible();
  await expect(quiz.getByTestId('zone-quiz')).toHaveCount(1);
  await expect(page.getByTestId('fluoro-panel')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'quiz');
  expect(await getMode(page)).toBe('quiz');
  await backHome(page);
});

test("Free play after Exam sets the mode back to 'freeplay'", async ({ page }) => {
  await press(page, 'home-exam');
  expect(await getMode(page)).toBe('exam');
  await backHome(page);
  await press(page, 'home-freeplay');
  await expect(page.getByTestId('fluoro-panel')).toBeVisible();
  expect(await getMode(page)).toBe('freeplay');
});

test('every new button is at least 44×44 px, and so is the Home button on each new screen', async ({ page }) => {
  for (const testid of ['home-practice', 'home-exam', 'home-quiz']) {
    await expectAtLeast44(page, testid);
    await press(page, testid);
    await expectAtLeast44(page, 'home-button');
    await backHome(page);
  }
});
