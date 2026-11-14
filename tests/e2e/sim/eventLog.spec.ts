// F6.5: the event log in the needle panel lists this attempt's events, newest first.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { emitCaseStart, getSim, moveDownMidline } from './simZone';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await getSim(page);
});

test('at start the event log is in the needle panel and empty', async ({ page }) => {
  const log = page.getByTestId('needle-panel').getByTestId('event-log');
  await expect(log).toHaveCount(1);
  await expect(log.getByTestId('event-log-row')).toHaveCount(0);
});

test('moving a hand-made needle down the midline shows "Dural puncture" above "Loss of resistance"', async ({ page }) => {
  await moveDownMidline(page, 46, 10);
  const rows = page.getByTestId('event-log-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Dural puncture');
  await expect(rows.nth(1)).toContainText('Loss of resistance');
  // Each row shows the time in seconds with one decimal, matching the stored event.
  const { events } = await getSim(page);
  expect(events.map((e) => e.message)).toEqual(['Loss of resistance', 'Dural puncture']);
  await expect(rows.nth(0)).toContainText(`${events[1].time.toFixed(1)} s`);
  await expect(rows.nth(1)).toContainText(`${events[0].time.toFixed(1)} s`);
  await expect(rows.nth(0)).toBeVisible();
});

test('emitting caseStart empties the log', async ({ page }) => {
  await moveDownMidline(page, 46, 10);
  await expect(page.getByTestId('event-log-row')).toHaveCount(2);
  await emitCaseStart(page);
  await expect(page.getByTestId('event-log-row')).toHaveCount(0);
  expect((await getSim(page)).events).toEqual([]);
});

test('with events in the log, the page does not scroll and the log stays inside the needle panel', async ({ page }) => {
  // Down to the cord, back out and in again: several events.
  await moveDownMidline(page, 46, 4);
  await moveDownMidline(page, 20, 4);
  await expect.poll(async () => page.getByTestId('event-log-row').count()).toBeGreaterThanOrEqual(5);
  const viewport = page.viewportSize()!;
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual(viewport);
  const panel = (await page.getByTestId('needle-panel').boundingBox())!;
  const log = (await page.getByTestId('event-log').boundingBox())!;
  expect(log.y + log.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  await expect(page.getByTestId('event-log-row').first()).toBeInViewport();
});
