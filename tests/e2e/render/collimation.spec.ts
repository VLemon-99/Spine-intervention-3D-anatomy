// F2.5 on the GPU: the four shutters belong to taking the image; covered
// pixels show one uniform "no signal" value.
import { expect, test } from '@playwright/test';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { NO_SIGNAL, isCollimated } from '../../../src/render/pipeline';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import {
  MAX_MEAN_DIFFERENCE,
  getRenderInfo,
  meanDifference,
  readWholeCanvas,
  samePixels,
  setRenderSettings,
} from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const SHUTTERS = { left: 20, right: 10, top: 30, bottom: 0 };
const phantom = createPhantom();

/** Smallest and largest grey value among the covered pixels, the same among the open ones, and the counts. */
function coveredAndOpen(canvas: { width: number; height: number; data: Uint8Array }) {
  const covered = { min: 255, max: 0, count: 0 };
  const open = { min: 255, max: 0, count: 0 };
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const part = isCollimated(x, y, SHUTTERS) ? covered : open;
      const value = canvas.data[x + canvas.width * y]!;
      part.min = Math.min(part.min, value);
      part.max = Math.max(part.max, value);
      part.count += 1;
    }
  }
  return { covered, open };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
});

test('all pixels outside the open rectangle have one single grey value', async ({ page }) => {
  await setRenderSettings(page, { collimation: SHUTTERS });
  await takeImage(page);
  const { covered, open } = coveredAndOpen(await readWholeCanvas(page));
  // The open rectangle is columns 103…459 and rows 154…511 (see tests/render/collimation.test.ts).
  expect(open.count).toBe(357 * 358);
  expect(covered.max - covered.min).toBe(0);
  expect(covered.min).toBe(Math.round(NO_SIGNAL * 255));
  // The open part still shows the picture.
  expect(open.max - open.min).toBeGreaterThan(50);
});

test('the covered area is just as uniform with Invert on', async ({ page }) => {
  await setRenderSettings(page, { collimation: SHUTTERS, invert: true });
  await takeImage(page);
  const inverted = coveredAndOpen(await readWholeCanvas(page));
  expect(inverted.covered.max - inverted.covered.min).toBe(0);
  expect(inverted.open.max - inverted.open.min).toBeGreaterThan(50);

  // Switching Invert on the held image keeps it uniform too.
  await setRenderSettings(page, { invert: false });
  const normal = coveredAndOpen(await readWholeCanvas(page));
  expect(normal.covered.max - normal.covered.min).toBe(0);
  expect(normal.covered.min).toBe(255 - inverted.covered.min);
});

test('the whole canvas matches the CPU reference with the same collimation', async ({ page }) => {
  const reference = renderDrrCpu(phantom, DEFAULT_POSE, { collimation: SHUTTERS });
  // The collimated reference differs from the open one by more than the limit.
  const plain = renderDrrCpu(phantom, DEFAULT_POSE);
  let sum = 0;
  for (let i = 0; i < plain.data.length; i++) sum += Math.abs(plain.data[i]! - reference.data[i]!) * 255;
  expect(sum / plain.data.length).toBeGreaterThan(MAX_MEAN_DIFFERENCE);

  await setRenderSettings(page, { collimation: SHUTTERS });
  await takeImage(page);
  const mean = meanDifference(await readWholeCanvas(page), reference);
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
});

test('it also matches the CPU reference together with magnification 2', async ({ page }) => {
  const reference = renderDrrCpu(phantom, DEFAULT_POSE, { collimation: SHUTTERS, magnification: 2 });
  await setRenderSettings(page, { collimation: SHUTTERS, magnification: 2 });
  await takeImage(page);
  const canvas = await readWholeCanvas(page);
  expect(meanDifference(canvas, reference)).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
  const { covered } = coveredAndOpen(canvas);
  expect(covered.max - covered.min).toBe(0);
});

test('changing the shutters without taking an image leaves the canvas unchanged', async ({ page }) => {
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await setRenderSettings(page, { collimation: SHUTTERS });
  expect((await getRenderInfo(page)).settings.collimation).toEqual(SHUTTERS);
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
  expect((await getSimState(page)).shotCount).toBe(1);

  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), before)).toBe(false);
  expect((await getRenderInfo(page)).lastImage?.settings.collimation).toEqual(SHUTTERS);
});
