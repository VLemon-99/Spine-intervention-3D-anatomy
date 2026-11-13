// F5.2 support (render zone): a click (desktop) or tap (tablet) on the held
// fluoro image emits 'imageTap' with the pixel of the image as taken.
import { expect, test, type Page } from '@playwright/test';
import type { ImageTap } from '../../../src/core/store';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { setRenderSettings } from './renderPage';

type TapWindow = { __imageTaps: ImageTap[] };

/** Start recording 'imageTap' events through the app's own store module as served by the dev server. */
async function listenForTaps(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { bus } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    const w = window as unknown as TapWindow;
    w.__imageTaps = [];
    bus.on('imageTap', (tap) => w.__imageTaps.push({ ...tap }));
  });
}

const recordedTaps = (page: Page): Promise<ImageTap[]> =>
  page.evaluate(() => (window as unknown as TapWindow).__imageTaps);

/**
 * Click (desktop) or tap (tablet) the fluoro canvas at a fraction of its width
 * and height (0.5, 0.5 = its centre).
 */
async function tapCanvas(page: Page, fx: number, fy: number): Promise<void> {
  const canvas = page.getByTestId('fluoro-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas box');
  const position = { x: box.width * fx, y: box.height * fy };
  if (test.info().project.use.hasTouch) {
    await canvas.tap({ position });
  } else {
    await canvas.click({ position });
  }
}

/** Give a possible event time to arrive (events are emitted synchronously on the click). */
const settle = (page: Page): Promise<void> => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await listenForTaps(page);
});

test('after one image, tapping the canvas centre emits one imageTap of (256, 256)', async ({ page }) => {
  await takeImage(page);
  await tapCanvas(page, 0.5, 0.5);
  await settle(page);
  const taps = await recordedTaps(page);
  expect(taps).toHaveLength(1);
  expect(Math.abs(taps[0]!.x - 256)).toBeLessThanOrEqual(1);
  expect(Math.abs(taps[0]!.y - 256)).toBeLessThanOrEqual(1);
});

test('before the first image a tap emits nothing', async ({ page }) => {
  await tapCanvas(page, 0.5, 0.5);
  await settle(page);
  expect(await recordedTaps(page)).toEqual([]);
});

test('with the left shutter closed to 20%, a tap in the covered area emits nothing and the open centre still emits', async ({
  page,
}) => {
  await setRenderSettings(page, { collimation: { left: 20 } });
  await takeImage(page);
  await tapCanvas(page, 0.08, 0.5);
  await settle(page);
  expect(await recordedTaps(page)).toEqual([]);
  await tapCanvas(page, 0.5, 0.5);
  await settle(page);
  const taps = await recordedTaps(page);
  expect(taps).toHaveLength(1);
  expect(Math.abs(taps[0]!.x - 256)).toBeLessThanOrEqual(1);
});
