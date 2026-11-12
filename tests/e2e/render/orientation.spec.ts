// F2.7 on the GPU: flips and rotation re-display the held image straight
// away, with the same pixel mapping as the CPU reference.
import { expect, test } from '@playwright/test';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { orientPixel, type Orientation } from '../../../src/render/orientation';
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

// A pose whose picture has no left-right or up-down symmetry, so a wrong mapping cannot pass.
const POSE: CArmPose = { oblique: 30, tilt: 15, tableLeftRight: 20, tableHeadFoot: -15, tableHeight: 0 };
const NONE: Orientation = { flipHorizontal: false, flipVertical: false, rotation: 0 };
const phantom = createPhantom();

/** Largest difference between the canvas `now` and the canvas `before` moved as the orientation says. */
function worstAfterMove(now: Uint8Array, before: Uint8Array, orientation: Orientation): number {
  let worst = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const to = orientPixel({ x, y }, orientation);
      worst = Math.max(worst, Math.abs(now[to.x + 512 * to.y]! - before[x + 512 * y]!));
    }
  }
  return worst;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
  await setPose(page, POSE);
  await takeImage(page);
});

for (const { name, patch } of [
  { name: 'flip left-right', patch: { flipHorizontal: true } },
  { name: 'flip up-down', patch: { flipVertical: true } },
  { name: 'rotation 90°', patch: { rotation: 90 } },
  { name: 'rotation 180°', patch: { rotation: 180 } },
  { name: 'rotation 270°', patch: { rotation: 270 } },
  { name: 'both flips with rotation 270°', patch: { flipHorizontal: true, flipVertical: true, rotation: 270 } },
] as const) {
  test(`${name} moves every pixel of the held image as predicted, without a new image`, async ({ page }) => {
    const before = await readWholeCanvas(page);
    const orientation: Orientation = { ...NONE, ...patch };
    // The picture is not symmetric: moved as predicted it differs clearly from the original.
    expect(worstAfterMove(before.data, before.data, orientation)).toBeGreaterThan(50);
    const imageBefore = (await getRenderInfo(page)).lastImage;

    // Move the C-arm too (no image): a re-taken picture would look different.
    await setPose(page, { oblique: -20, tilt: 0 });
    await setRenderSettings(page, patch);

    const after = await readWholeCanvas(page);
    expect(samePixels(after, before)).toBe(false);
    expect(worstAfterMove(after.data, before.data, orientation)).toBeLessThanOrEqual(1);
    expect((await getSimState(page)).shotCount).toBe(1);
    expect((await getRenderInfo(page)).lastImage).toEqual(imageBefore);

    // Back to the plain orientation restores the picture.
    await setRenderSettings(page, NONE);
    expect(worstAfterMove((await readWholeCanvas(page)).data, before.data, NONE)).toBeLessThanOrEqual(1);
  });
}

test('flip left-right plus rotation 90° matches the CPU reference with the same options', async ({ page }) => {
  const options = { flipHorizontal: true, rotation: 90 } as const;
  const reference = renderDrrCpu(phantom, POSE, options);
  expect(reference.data.some((v) => v < 0.5)).toBe(true);
  expect(reference.data.some((v) => v === 1)).toBe(true);
  // How far the plain (not flipped, not rotated) reference is from the oriented
  // one. Most of the picture is air, so this is only a few grey levels — close
  // to the 3% limit — and the canvas must therefore be far closer than that.
  const plain = renderDrrCpu(phantom, POSE);
  let sum = 0;
  for (let i = 0; i < plain.data.length; i++) sum += Math.abs(plain.data[i]! - reference.data[i]!) * 255;
  const plainDifference = sum / plain.data.length;
  expect(plainDifference).toBeGreaterThan(4);

  await setRenderSettings(page, options);
  const mean = meanDifference(await readWholeCanvas(page), reference);
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
  expect(mean, 'a picture shown without the flip and rotation would be this far off').toBeLessThan(plainDifference / 4);

  // An image taken with the orientation already set is shown the same way.
  await takeImage(page);
  expect(meanDifference(await readWholeCanvas(page), reference)).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
});

test('invert and orientation work together on the held image', async ({ page }) => {
  const options = { invert: true, flipVertical: true, rotation: 180 } as const;
  await setRenderSettings(page, options);
  const mean = meanDifference(await readWholeCanvas(page), renderDrrCpu(phantom, POSE, options));
  expect(mean).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
});
