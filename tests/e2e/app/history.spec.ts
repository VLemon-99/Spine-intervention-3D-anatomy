import { expect, test, type Page } from '@playwright/test';
import { getSimState, takeImage } from '../../fixtures/simPage';
import type { AttemptRecord } from '../../../src/core/types';

// F12.4: the History screen lists finished attempts newest first, survives a
// reload, clears only after confirming, and says so when storage is blocked.
// Records are made up and added through the dev server's history module (the
// app's own instance), because procedures and the quiz do not exist yet.

const RECORDS: AttemptRecord[] = [
  {
    kind: 'procedure',
    mode: 'practice',
    procedureId: 'test-procedure-a',
    date: '2026-01-01T09:00:00Z',
    totalScore: 41,
    scoreParts: { views: 20, accuracy: 21 },
    unsafe: false,
    shots: 9,
    fluoroTimeSeconds: 14.5,
  },
  {
    kind: 'quiz',
    mode: 'quiz',
    date: '2026-01-03T09:00:00Z',
    totalScore: 87,
    scoreParts: { correct: 87 },
    unsafe: false,
  },
  {
    kind: 'procedure',
    mode: 'exam',
    procedureId: 'test-procedure-b',
    date: '2026-01-02T09:00:00Z',
    totalScore: 12,
    scoreParts: { views: 12 },
    unsafe: true,
    shots: 30,
  },
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

async function addRecords(page: Page, records: AttemptRecord[]): Promise<void> {
  await page.evaluate(async (list) => {
    const historyModule = '/src/app/history.ts';
    const { history } = (await import(/* @vite-ignore */ historyModule)) as typeof import('../../../src/app/history');
    for (const record of list) history.add(record);
  }, records);
}

/** From a fresh load: past the disclaimer if shown, then History. */
async function openHistory(page: Page): Promise<void> {
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  if ((await page.getByTestId('disclaimer-accept').count()) > 0) await press(page, 'disclaimer-accept');
  await press(page, 'home-history');
  await expect(page.getByTestId('history-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'history');
}

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

async function expectEntriesNewestFirst(page: Page): Promise<void> {
  const entries = page.getByTestId('history-entry');
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(0)).toContainText('Score 87');
  await expect(entries.nth(0)).toContainText('Quiz');
  await expect(entries.nth(1)).toContainText('Score 12');
  await expect(entries.nth(1)).toContainText('test-procedure-b');
  await expect(entries.nth(2)).toContainText('Score 41');
  await expect(entries.nth(2)).toContainText('test-procedure-a');
  await expect(entries.nth(2)).toContainText('9 shots');
  await expect(entries.nth(2)).toContainText('Fluoro 14.5 s');
  await expect(page.getByTestId('history-unsafe')).toHaveCount(1);
  await expect(entries.nth(1).getByTestId('history-unsafe')).toHaveText('Unsafe');
}

test('three added records are listed newest first, with their scores and an Unsafe mark on the flagged one', async ({
  page,
}) => {
  await page.goto('/');
  await addRecords(page, RECORDS);
  await openHistory(page);
  await expectEntriesNewestFirst(page);
  await expect(page.getByTestId('history-unavailable')).toBeHidden();
  await expect(page.getByTestId('history-empty')).toBeHidden();
});

test('an empty history says so', async ({ page }) => {
  await page.goto('/');
  await openHistory(page);
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await expect(page.getByTestId('history-entry')).toHaveCount(0);
});

test('after reloading the page, the same records are still listed', async ({ page }) => {
  await page.goto('/');
  await addRecords(page, RECORDS);
  await page.reload();
  await openHistory(page);
  await expectEntriesNewestFirst(page);
});

test('Clear history asks first: Cancel keeps the records, Confirm removes them for good', async ({ page }) => {
  await page.goto('/');
  await addRecords(page, RECORDS);
  await openHistory(page);

  await press(page, 'history-clear');
  await expect(page.getByTestId('history-clear-confirm')).toBeVisible();
  await press(page, 'history-clear-cancel');
  await expect(page.getByTestId('history-clear-confirm')).toBeHidden();
  await expect(page.getByTestId('history-entry')).toHaveCount(3);

  await press(page, 'history-clear');
  await press(page, 'history-clear-confirm');
  await expect(page.getByTestId('history-entry')).toHaveCount(0);
  await expect(page.getByTestId('history-empty')).toBeVisible();

  await page.reload();
  await openHistory(page);
  await expect(page.getByTestId('history-entry')).toHaveCount(0);
});

test("with local storage blocked, it says history can't be saved, and Free play and a Shot still work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await blockStorage(page);
  await page.goto('/');
  await openHistory(page);
  await expect(page.getByTestId('history-unavailable')).toHaveText("History can't be saved in this browser");

  await press(page, 'home-button');
  await press(page, 'home-freeplay');
  await expect(page.getByTestId('fluoro-panel')).toBeVisible();
  await takeImage(page);
  expect((await getSimState(page)).shotCount).toBe(1);
  expect(errors).toEqual([]);
});

test('every button on the screen and in the dialog is at least 44×44 px', async ({ page }) => {
  await page.goto('/');
  await addRecords(page, RECORDS);
  await openHistory(page);
  const check = async (testid: string): Promise<void> => {
    const box = await page.getByTestId(testid).boundingBox();
    expect(box, `${testid} has no box`).not.toBeNull();
    if (!box) return;
    expect(box.width, `${testid} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${testid} height`).toBeGreaterThanOrEqual(44);
  };
  await check('home-button');
  await check('history-clear');
  await press(page, 'history-clear');
  await check('history-clear-confirm');
  await check('history-clear-cancel');
  await press(page, 'history-clear-cancel');
  await press(page, 'home-button');
  await check('home-history');
});
