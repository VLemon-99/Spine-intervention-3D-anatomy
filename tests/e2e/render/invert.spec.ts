// F2.3: Invert re-displays the held image straight away, with no new exposure.
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { getRenderInfo, readWholeCanvas, setRenderSettings } from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const CORNER = { x: 0, y: 0 };
const blockPixel = createProjection(DEFAULT_POSE).project(PHANTOM_TEST_POINTS.blockCentres.upper);

/** Largest difference between each pixel of `now` and what `expected(before pixel)` predicts. */
function worstDifference(now: Uint8Array, before: Uint8Array, expected: (v: number) => number): number {
  expect(now.length).toBe(before.length);
  let worst = 0;
  for (let i = 0; i < now.length; i++) worst = Math.max(worst, Math.abs(now[i]! - expected(before[i]!)));
  return worst;
}

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
  await takeImage(page);
}

test.beforeEach(async ({ page }) => {
  await start(page);
});

test('turning invert on changes the canvas without a new image, and bone becomes lighter than air', async ({
  page,
}) => {
  const before = await readWholeCanvas(page);
  const [blockBefore, cornerBefore] = await readCanvas(page, [blockPixel, CORNER]);
  expect(blockBefore!).toBeLessThan(cornerBefore!);
  const shotsBefore = (await getSimState(page)).shotCount;
  const imageBefore = (await getRenderInfo(page)).lastImage;

  await setRenderSettings(page, { invert: true });

  const after = await readWholeCanvas(page);
  expect(Buffer.from(after.data).equals(Buffer.from(before.data))).toBe(false);
  const [block, corner] = await readCanvas(page, [blockPixel, CORNER]);
  expect(block!, `block ${block}, corner ${corner}`).toBeGreaterThan(corner!);
  expect((await getSimState(page)).shotCount).toBe(shotsBefore);
  // Still the same exposure (same noise seed), not a new one.
  expect((await getRenderInfo(page)).lastImage).toEqual(imageBefore);
});

test('invert re-displays the held image: after the pose changes, every pixel is 255 − its earlier value', async ({
  page,
}) => {
  const before = await readWholeCanvas(page);
  // A blank picture would pass trivially: it must contain dark and light pixels.
  expect(before.data.some((v) => v < 100)).toBe(true);
  expect(before.data.some((v) => v === 255)).toBe(true);

  // Move the C-arm without taking an image: a re-taken image would look different.
  await setPose(page, { oblique: 40, tilt: 20, tableLeftRight: 15 });
  await setRenderSettings(page, { invert: true });

  const after = await readWholeCanvas(page);
  expect(worstDifference(after.data, before.data, (v) => 255 - v)).toBeLessThanOrEqual(1);
  expect((await getSimState(page)).shotCount).toBe(1);
  expect((await getSimState(page)).lastImagePose).toEqual(DEFAULT_POSE);
});

test('turning invert off again restores the earlier pixels', async ({ page }) => {
  const before = await readWholeCanvas(page);
  await setPose(page, { oblique: 40, tilt: 20 });
  await setRenderSettings(page, { invert: true });
  expect(worstDifference((await readWholeCanvas(page)).data, before.data, (v) => 255 - v)).toBeLessThanOrEqual(1);
  await setRenderSettings(page, { invert: false });
  expect(worstDifference((await readWholeCanvas(page)).data, before.data, (v) => v)).toBeLessThanOrEqual(1);
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('an image taken while invert is on is shown inverted, and it is a new exposure', async ({ page }) => {
  const before = await readWholeCanvas(page);
  await setRenderSettings(page, { invert: true });
  await takeImage(page);
  expect(worstDifference((await readWholeCanvas(page)).data, before.data, (v) => 255 - v)).toBeLessThanOrEqual(1);
  expect((await getRenderInfo(page)).lastImage?.noiseSeed).toBe(2);
});

test('changing invert before the first image leaves the blank screen alone', async ({ page }) => {
  await page.reload();
  await getSimState(page);
  await acceptDisclaimer(page);
  const blank = await readWholeCanvas(page);
  await setRenderSettings(page, { invert: true });
  expect(Buffer.from((await readWholeCanvas(page)).data).equals(Buffer.from(blank.data))).toBe(true);
});
