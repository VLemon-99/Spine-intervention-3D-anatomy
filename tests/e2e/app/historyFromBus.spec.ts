import { expect, test, type Page } from '@playwright/test';
import type { AttemptRecord } from '../../../src/core/types';

// F12.4 / F10.5 / F11.4: records handed over with the bus event
// 'attemptFinished' are saved in the history. Made-up records only.

const OLDER: AttemptRecord = {
  kind: 'procedure',
  mode: 'exam',
  procedureId: 'test-procedure-a',
  date: '2026-02-01T09:00:00Z',
  totalScore: 33,
  scoreParts: { views: 33 },
  unsafe: true,
  shots: 12,
  fluoroTimeSeconds: 20,
};
const NEWER: AttemptRecord = {
  kind: 'quiz',
  mode: 'quiz',
  date: '2026-02-02T09:00:00Z',
  totalScore: 76,
  scoreParts: { correct: 76 },
  unsafe: false,
};

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string): Promise<void> {
  const button = page.getByTestId(testid);
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
}

/** Emit 'attemptFinished' through the dev server's store module (the app's own bus). */
async function emitFinished(page: Page, record: unknown): Promise<void> {
  await page.evaluate(async (payload) => {
    const storeModule = '/src/core/store.ts';
    const { bus } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    bus.emit('attemptFinished', payload as AttemptRecord);
  }, record);
}

async function openHistory(page: Page): Promise<void> {
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  if ((await page.getByTestId('disclaimer-accept').count()) > 0) await press(page, 'disclaimer-accept');
  await press(page, 'home-history');
  await expect(page.getByTestId('history-screen')).toBeVisible();
}

async function expectBothNewestFirst(page: Page): Promise<void> {
  const entries = page.getByTestId('history-entry');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText('Score 76');
  await expect(entries.nth(1)).toContainText('Score 33');
  await expect(entries.nth(1).getByTestId('history-unsafe')).toBeVisible();
}

test('after two attemptFinished events, the History screen lists both, newest first, also after a reload', async ({
  page,
}) => {
  await page.goto('/');
  await emitFinished(page, OLDER);
  await emitFinished(page, NEWER);
  await openHistory(page);
  await expectBothNewestFirst(page);
  await page.reload();
  await openHistory(page);
  await expectBothNewestFirst(page);
});

test('a record arriving while the History screen is open shows up straight away', async ({ page }) => {
  await page.goto('/');
  await openHistory(page);
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await emitFinished(page, OLDER);
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
});

test('an attemptFinished event with an invalid record adds nothing and causes no page error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await emitFinished(page, { kind: 'procedure', mode: 'exam', totalScore: 'lots' });
  await emitFinished(page, null);
  await emitFinished(page, { ...NEWER, totalScore: 500 });
  await openHistory(page);
  await expect(page.getByTestId('history-entry')).toHaveCount(0);
  await expect(page.getByTestId('history-empty')).toBeVisible();
  expect(errors).toEqual([]);
});
