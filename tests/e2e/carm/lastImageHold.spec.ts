// F3-S8: last image hold (F3.5, F3.3). Moving the C-arm without taking an
// image leaves the picture on screen unchanged; a new Shot replaces it.
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas, type PixelPosition } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { dragSlider } from './controls';

/** A fixed 16×16 grid of points over the 512×512 image. */
const GRID: PixelPosition[] = [];
for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) GRID.push({ x: 16 + i * 32, y: 16 + j * 32 });

const fingerprint = (page: Page): Promise<number[]> => readCanvas(page, GRID);

/** Let the renderer finish drawing: two animation frames. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('moving the C-arm without an image leaves the picture unchanged; a new Shot replaces it', async ({ page }) => {
  await takeImage(page);
  await settle(page);
  const first = await getSimState(page);
  const before = await fingerprint(page);

  // Move oblique and tilt with the sliders (mouse drag on desktop, touch drag on the tablet).
  await dragSlider(page, 'slider-oblique', 0.8);
  await dragSlider(page, 'slider-tilt', 0.8);
  // On desktop, also with a pose key.
  if (!test.info().project.use.hasTouch) await page.keyboard.press('Shift+KeyL');
  await page.waitForTimeout(500);

  const moved = await getSimState(page);
  expect(moved.pose.oblique).toBeGreaterThan(30);
  expect(moved.pose.tilt).toBeGreaterThan(15);
  expect(moved.pose).not.toEqual(moved.lastImagePose);
  expect(moved.lastImagePose).toEqual(first.lastImagePose);
  expect(moved.shotCount).toBe(first.shotCount);
  expect(await fingerprint(page)).toEqual(before);

  // One more Shot: count +1 exactly, last image pose = new pose, picture changes.
  await takeImage(page);
  await settle(page);
  await page.waitForTimeout(200);
  const second = await getSimState(page);
  expect(second.shotCount).toBe(first.shotCount + 1);
  expect(second.lastImagePose).toEqual(moved.pose);
  expect(await fingerprint(page)).not.toEqual(before);
});
