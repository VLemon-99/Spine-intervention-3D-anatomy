// F2.6: continuous-fluoro frames are taken with more grain than single shots.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { CArmPose } from '../../../src/core/types';
import { defaultNoiseLevel } from '../../../src/render/pipeline';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { getRenderInfo, readWholeCanvas, setRenderSettings, takeFluoroFrame } from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
// The soft-tissue area used in F2-S13: around the projection of (30, 0, 0).
const SOFT = createProjection(DEFAULT_POSE).project({ x: 30, y: 0, z: 0 });
const RATIO = defaultNoiseLevel('fluoro') / defaultNoiseLevel('shot');

/** Standard deviation of the canvas values in 3 columns × 61 rows around the soft-tissue point. */
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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('a single shot reports kind shot and the setting; a fluoro frame reports kind fluoro and a higher level', async ({
  page,
}) => {
  await takeImage(page); // spacebar on desktop, the Shot button on the tablet
  let info = await getRenderInfo(page);
  expect(info.lastImage?.kind).toBe('shot');
  expect(info.lastImage?.noiseLevel).toBe(info.settings.noiseLevel);
  expect(info.settings.noiseLevel).toBe(defaultNoiseLevel('shot'));

  await takeFluoroFrame(page);
  info = await getRenderInfo(page);
  expect(info.lastImage?.kind).toBe('fluoro');
  expect(info.lastImage?.noiseLevel).toBeGreaterThan(info.settings.noiseLevel);
  expect(info.lastImage?.noiseLevel).toBeCloseTo(defaultNoiseLevel('fluoro'), 10);
  expect(info.lastImage?.noiseSeed).toBe(2);
  // A fluoro frame is not a shot, and the setting itself is untouched.
  expect((await getSimState(page)).shotCount).toBe(1);
  expect(info.settings.noiseLevel).toBe(defaultNoiseLevel('shot'));

  // A shot after fluoro goes back to the setting.
  await takeImage(page);
  info = await getRenderInfo(page);
  expect(info.lastImage?.kind).toBe('shot');
  expect(info.lastImage?.noiseLevel).toBe(info.settings.noiseLevel);
});

test('the fluoro level follows the setting: scaled by the ratio of the defaults, never above 1, and 0 stays 0', async ({
  page,
}) => {
  await setRenderSettings(page, { noiseLevel: 0.2 });
  await takeFluoroFrame(page);
  expect((await getRenderInfo(page)).lastImage?.noiseLevel).toBeCloseTo(0.2 * RATIO, 10);

  await setRenderSettings(page, { noiseLevel: 0.9 });
  await takeFluoroFrame(page);
  expect((await getRenderInfo(page)).lastImage?.noiseLevel).toBe(1);

  await setRenderSettings(page, { noiseLevel: 0 });
  await takeFluoroFrame(page);
  expect((await getRenderInfo(page)).lastImage?.noiseLevel).toBe(0);
});

test('in soft tissue a fluoro frame is grainier than a single shot at the same pose and setting', async ({ page }) => {
  await takeImage(page);
  const shot = softTissueSpread(await readWholeCanvas(page));
  await takeFluoroFrame(page);
  const fluoro = softTissueSpread(await readWholeCanvas(page));
  expect((await getSimState(page)).lastImagePose).toEqual(DEFAULT_POSE);
  expect(fluoro, `shot ${shot.toFixed(2)}, fluoro ${fluoro.toFixed(2)}`).toBeGreaterThan(shot);

  // The other way round too, so it is the kind and not the order that matters.
  await takeImage(page);
  expect(softTissueSpread(await readWholeCanvas(page))).toBeLessThan(fluoro);
});
