// Final check for F2: every setting switched on at once. The canvas must match
// the CPU reference given the same options — this catches steps applied in a
// different order by the two renderers (see the ORDER OF STEPS in pipeline.ts).
import { expect, test } from '@playwright/test';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu, type DrrCpuOptions } from '../../../src/render/drrCpu';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import {
  MAX_MEAN_DIFFERENCE,
  getRenderInfo,
  meanDifference,
  readWholeCanvas,
  setContrast,
  setRenderSettings,
} from './renderPage';

const POSE: CArmPose = { oblique: 30, tilt: 15, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const phantom = createPhantom();

/** A full-strength blob (5 × 4 × 6 voxels) of contrast in the soft tissue beside the spine. */
function blob(): Uint8Array {
  const { x: nx, y: ny } = phantom.size;
  const extra = new Uint8Array(phantom.intensity.length);
  for (let k = 60; k < 66; k++) for (let j = 50; j < 54; j++) for (let i = 72; i < 77; i++) extra[i + nx * (j + ny * k)] = 255;
  return extra;
}

const SETTINGS = {
  magnification: 1.5,
  collimation: { left: 10, right: 5, top: 15, bottom: 20 },
  invert: true,
  flipHorizontal: true,
  rotation: 90,
} as const;
const ALL_ON: DrrCpuOptions = { ...SETTINGS, extraAbsorption: blob() };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('with every setting on at once, the canvas matches the CPU reference', async ({ page }) => {
  const reference = renderDrrCpu(phantom, POSE, ALL_ON);
  // Not a flat picture: it has dark and light parts.
  expect(reference.data.some((v) => v < 0.2)).toBe(true);
  expect(reference.data.some((v) => v > 0.8)).toBe(true);

  await setPose(page, POSE);
  await setRenderSettings(page, { ...SETTINGS, noiseLevel: 0 });
  await setContrast(page, blob());
  await takeImage(page);
  expect((await getRenderInfo(page)).lastImage?.noiseLevel).toBe(0);

  const canvas = await readWholeCanvas(page);
  const mean = meanDifference(canvas, reference);
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);

  // The 3% limit is loose on the phantom, so also: the canvas must be much
  // closer to the right picture than to a picture with any ONE step left out
  // or the two orientation steps swapped.
  const wrongPictures: Record<string, DrrCpuOptions> = {
    'no magnification': { ...ALL_ON, magnification: 1 },
    'no collimation': { ...ALL_ON, collimation: { left: 0, right: 0, top: 0, bottom: 0 } },
    'no contrast': { ...SETTINGS },
    'no invert': { ...ALL_ON, invert: false },
    'no flip': { ...ALL_ON, flipHorizontal: false },
    'no rotation': { ...ALL_ON, rotation: 0 },
    // Rotating first and then flipping left-right equals flipping up-down first and then rotating.
    'rotation before the flip': { ...ALL_ON, flipHorizontal: false, flipVertical: true },
  };
  for (const [name, options] of Object.entries(wrongPictures)) {
    const wrong = renderDrrCpu(phantom, POSE, options);
    // Look only at the pixels where the wrong picture differs from the right
    // one (a small feature such as the contrast blob barely moves a whole-image mean).
    let pixels = 0;
    let toRight = 0;
    let toWrong = 0;
    for (let i = 0; i < canvas.data.length; i++) {
      if (Math.abs(wrong.data[i]! - reference.data[i]!) * 255 < 2) continue;
      pixels += 1;
      toRight += Math.abs(canvas.data[i]! - reference.data[i]! * 255);
      toWrong += Math.abs(canvas.data[i]! - wrong.data[i]! * 255);
    }
    // The wrong picture really is a different picture …
    expect(pixels, name).toBeGreaterThan(20);
    // … and on those pixels the canvas is at least four times closer to the right one.
    expect(toRight / pixels, `${name}: ${(toRight / pixels).toFixed(2)} from right, ${(toWrong / pixels).toFixed(2)} from wrong`).toBeLessThan(
      toWrong / pixels / 4,
    );
  }
});

test('the same holds when the display settings are switched on after the image was taken', async ({ page }) => {
  await setPose(page, POSE);
  await setRenderSettings(page, { magnification: 1.5, collimation: SETTINGS.collimation, noiseLevel: 0 });
  await setContrast(page, blob());
  await takeImage(page);
  // Display settings only: no new image.
  await setRenderSettings(page, { invert: true, flipHorizontal: true, rotation: 90 });
  expect((await getSimState(page)).shotCount).toBe(1);
  const mean = meanDifference(await readWholeCanvas(page), renderDrrCpu(phantom, POSE, ALL_ON));
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
  expect(mean).toBeLessThan(1);
});
