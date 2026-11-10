// F2.4 on the GPU: magnification belongs to taking the image, so it shows
// from the next image on and matches the CPU reference.
import { expect, test } from '@playwright/test';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import {
  MAX_MEAN_DIFFERENCE,
  getRenderInfo,
  meanDifference,
  readWholeCanvas,
  samePixels,
  setRenderSettings,
} from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const OBLIQUE_POSE: CArmPose = { oblique: 30, tilt: 15, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const phantom = createPhantom();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
});

for (const { name, pose, magnification } of [
  { name: '1.5× at the default pose', pose: DEFAULT_POSE, magnification: 1.5 },
  { name: '2× at oblique +30°, tilt +15°', pose: OBLIQUE_POSE, magnification: 2 },
] as const) {
  test(`the canvas matches the CPU reference at ${name}`, async ({ page }) => {
    const reference = renderDrrCpu(phantom, pose, { magnification });
    expect(reference.data.some((v) => v < 0.5)).toBe(true);
    expect(reference.data.some((v) => v === 1)).toBe(true);
    // The magnified reference really differs from the plain one, so a GPU that ignores the setting fails.
    const plain = renderDrrCpu(phantom, pose);
    let plainDifference = 0;
    for (let i = 0; i < plain.data.length; i++) plainDifference += Math.abs(plain.data[i]! - reference.data[i]!) * 255;
    expect(plainDifference / plain.data.length).toBeGreaterThan(MAX_MEAN_DIFFERENCE);

    await setPose(page, pose);
    await setRenderSettings(page, { magnification });
    await takeImage(page);

    const mean = meanDifference(await readWholeCanvas(page), reference);
    expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
  });
}

test('changing the magnification leaves the held image alone until the next image is taken', async ({ page }) => {
  await takeImage(page);
  const at1x = await readWholeCanvas(page);
  expect((await getRenderInfo(page)).lastImage?.settings.magnification).toBe(1);

  await setRenderSettings(page, { magnification: 2 });
  expect((await getRenderInfo(page)).settings.magnification).toBe(2);
  expect(samePixels(await readWholeCanvas(page), at1x)).toBe(true);
  expect((await getRenderInfo(page)).lastImage?.settings.magnification).toBe(1);
  expect((await getSimState(page)).shotCount).toBe(1);

  await takeImage(page);
  expect((await getRenderInfo(page)).lastImage?.settings.magnification).toBe(2);
  const at2x = await readWholeCanvas(page);
  expect(samePixels(at2x, at1x)).toBe(false);
  const mean = meanDifference(at2x, renderDrrCpu(phantom, DEFAULT_POSE, { magnification: 2 }));
  expect(mean).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
});
