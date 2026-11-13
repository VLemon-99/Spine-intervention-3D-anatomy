// F7.1 on the GPU: the store's needle adds strong (metal) absorption along its
// shaft when an image is taken.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { putNeedle, readWholeCanvas, samePixels, setRenderSettings, straightTestNeedle } from './renderPage';

const POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const projection = createProjection(POSE);

/** Across the beam (along x), behind the laminae and above the upper block: soft tissue all round. */
const HUB: Vec3 = { x: -10, y: 30, z: 32 };
const TIP: Vec3 = { x: 10, y: 30, z: 32 };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
  await setPose(page, POSE);
});

test('pixels along a needle across the beam are darker than the pixels 5 px to the side', async ({ page }) => {
  await putNeedle(page, straightTestNeedle(HUB, TIP));
  await takeImage(page);
  const canvas = await readWholeCanvas(page);
  const grey = (x: number, y: number): number => canvas.data[x + canvas.width * y]!;
  // Nine points along the needle (not its very ends); it runs left-right in the image.
  for (let i = 1; i <= 9; i++) {
    const f = i / 10;
    const q = projection.project({ x: HUB.x + (TIP.x - HUB.x) * f, y: HUB.y, z: HUB.z });
    const x = Math.floor(q.x);
    const y = Math.floor(q.y);
    const onNeedle = grey(x, y);
    expect(onNeedle, `needle pixel (${x}, ${y}) vs 5 px above`).toBeLessThan(grey(x, y - 5));
    expect(onNeedle, `needle pixel (${x}, ${y}) vs 5 px below`).toBeLessThan(grey(x, y + 5));
  }
});

test('with no needle the image is the same as before the needle was put in and taken out', async ({ page }) => {
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await putNeedle(page, straightTestNeedle(HUB, TIP));
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), before)).toBe(false);
  await putNeedle(page, null);
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
});
