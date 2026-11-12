// F2.6 on the GPU: seeded X-ray grain is part of the image as taken.
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { defaultNoiseLevel, isCollimated } from '../../../src/render/pipeline';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { getRenderInfo, meanDifference, readWholeCanvas, samePixels, setRenderSettings } from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
// Soft tissue without bone: 30 mm to the patient's left of the canal, beside the bones.
const SOFT = createProjection(DEFAULT_POSE).project({ x: 30, y: 0, z: 0 });

/**
 * Standard deviation of the canvas values in the soft-tissue area: 3 pixel
 * columns × 61 rows around the soft-tissue point. Along the rows (the body's
 * long axis) the phantom is uniform there, so without grain the spread is tiny.
 */
function softTissueSpread(canvas: { data: Uint8Array }): number {
  const cx = Math.floor(SOFT.x);
  const cy = Math.floor(SOFT.y);
  let sum = 0;
  let sumSquares = 0;
  let n = 0;
  for (let y = cy - 30; y <= cy + 30; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      const v = canvas.data[x + 512 * y]!;
      sum += v;
      sumSquares += v * v;
      n += 1;
    }
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSquares / n - mean * mean));
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('the noise level starts at the single-shot default, which is above 0', async ({ page }) => {
  const { settings } = await getRenderInfo(page);
  expect(settings.noiseLevel).toBe(defaultNoiseLevel('shot'));
  expect(settings.noiseLevel).toBeGreaterThan(0);
});

test('with noise level 0, two images of the same pose are identical pixel for pixel', async ({ page }) => {
  await setRenderSettings(page, { noiseLevel: 0 });
  await takeImage(page);
  const first = await readWholeCanvas(page);
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), first)).toBe(true);
});

test('with noise, two images in a row differ, but a reloaded page repeats the same first image', async ({ page }) => {
  await setRenderSettings(page, { noiseLevel: 0.1 });
  await takeImage(page);
  const first = await readWholeCanvas(page);
  expect((await getRenderInfo(page)).lastImage?.noiseSeed).toBe(1);
  await takeImage(page);
  const second = await readWholeCanvas(page);
  expect((await getRenderInfo(page)).lastImage?.noiseSeed).toBe(2);
  expect(samePixels(second, first)).toBe(false);

  await page.reload();
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0.1 });
  await takeImage(page);
  expect((await getRenderInfo(page)).lastImage?.noiseSeed).toBe(1);
  expect(samePixels(await readWholeCanvas(page), first)).toBe(true);
});

test('in soft tissue the spread of the pixel values rises with the noise level', async ({ page }) => {
  const spreads: number[] = [];
  for (const noiseLevel of [0, 0.03, 0.1]) {
    await setRenderSettings(page, { noiseLevel });
    await takeImage(page);
    spreads.push(softTissueSpread(await readWholeCanvas(page)));
  }
  const [none, low, high] = spreads as [number, number, number];
  expect(low, `spreads ${spreads.map((s) => s.toFixed(2)).join(', ')}`).toBeGreaterThan(none);
  expect(high, `spreads ${spreads.map((s) => s.toFixed(2)).join(', ')}`).toBeGreaterThan(low);
});

test('collimated pixels still have one single grey value with noise on', async ({ page }) => {
  const shutters = { left: 20, right: 10, top: 30, bottom: 0 };
  await setRenderSettings(page, { noiseLevel: 1, collimation: shutters });
  await takeImage(page);
  const canvas = await readWholeCanvas(page);
  let min = 255;
  let max = 0;
  const open = new Set<number>();
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const v = canvas.data[x + 512 * y]!;
      if (isCollimated(x, y, shutters)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      } else {
        open.add(v);
      }
    }
  }
  expect(max - min).toBe(0);
  // The open part is clearly grainy at the highest level.
  expect(open.size).toBeGreaterThan(100);
});

test('turning Invert on and off again restores the exact pixels: the grain is not re-drawn', async ({ page }) => {
  await setRenderSettings(page, { noiseLevel: 0.5 });
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await setRenderSettings(page, { invert: true });
  const inverted = await readWholeCanvas(page);
  let worst = 0;
  for (let i = 0; i < before.data.length; i++) worst = Math.max(worst, Math.abs(inverted.data[i]! - (255 - before.data[i]!)));
  expect(worst).toBeLessThanOrEqual(1);
  await setRenderSettings(page, { invert: false });
  const after = await readWholeCanvas(page);
  worst = 0;
  for (let i = 0; i < before.data.length; i++) worst = Math.max(worst, Math.abs(after.data[i]! - before.data[i]!));
  expect(worst).toBeLessThanOrEqual(1);
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('changing the noise level does not change the held image', async ({ page }) => {
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await setRenderSettings(page, { noiseLevel: 1 });
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
});

test('the grainy image matches the CPU reference with the same seed and level', async ({ page }) => {
  // Both renderers take the grain from the same seeded number sequence.
  const phantom = createPhantom();
  await setRenderSettings(page, { noiseLevel: 0.5 });
  await takeImage(page);
  const canvas = await readWholeCanvas(page);
  const withSameGrain = meanDifference(canvas, renderDrrCpu(phantom, DEFAULT_POSE, { noise: { seed: 1, level: 0.5 } }));
  const withOtherGrain = meanDifference(canvas, renderDrrCpu(phantom, DEFAULT_POSE, { noise: { seed: 2, level: 0.5 } }));
  expect(withSameGrain, `same seed ${withSameGrain.toFixed(3)}, other seed ${withOtherGrain.toFixed(3)}`).toBeLessThan(1);
  expect(withOtherGrain).toBeGreaterThan(withSameGrain * 4);
});
