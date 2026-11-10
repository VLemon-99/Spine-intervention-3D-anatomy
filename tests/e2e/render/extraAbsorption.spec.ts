// F2.8 on the GPU: the store's contrast volume is added to the absorption
// along each ray when an image is taken.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import {
  MAX_MEAN_DIFFERENCE,
  meanDifference,
  readWholeCanvas,
  samePixels,
  setContrast,
  setRenderSettings,
} from './renderPage';

const POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const phantom = createPhantom();
const voxels = phantom.intensity.length;

/** A full-strength blob (5 × 4 × 6 voxels) in the soft tissue to the patient's left of the spine. */
function blob(): Uint8Array {
  const { x: nx, y: ny } = phantom.size;
  const extra = new Uint8Array(voxels);
  for (let k = 60; k < 66; k++) for (let j = 50; j < 54; j++) for (let i = 72; i < 77; i++) extra[i + nx * (j + ny * k)] = 255;
  return extra;
}
const BLOB_CENTRE = { x: phantom.origin.x + 74, y: phantom.origin.y + 51.5, z: phantom.origin.z + 62.5 };
const blobPixel = (() => {
  const p = createProjection(POSE).project(BLOB_CENTRE);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
})();
/** A pixel in the body's soft tissue on the other side of the spine, far from the blob. */
const farPixel = { x: 511 - blobPixel.x, y: 511 - blobPixel.y };

const plainReference = renderDrrCpu(phantom, POSE);
const blobReference = renderDrrCpu(phantom, POSE, { extraAbsorption: blob() });
/** Pixels whose rays cross the blob, according to the CPU reference. */
const crossesBlob = blobReference.data.map((v, i) => (v !== plainReference.data[i] ? 1 : 0));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
});

test('with a blob of contrast in the store, a new image matches the CPU reference', async ({ page }) => {
  await setContrast(page, blob());
  await takeImage(page);
  const canvas = await readWholeCanvas(page);
  const mean = meanDifference(canvas, blobReference);
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);

  // The blob is small, so the whole-image mean alone would not notice it missing:
  // also compare just the pixels whose rays cross it.
  let sum = 0;
  let sumIfMissing = 0;
  let count = 0;
  for (let i = 0; i < canvas.data.length; i++) {
    if (!crossesBlob[i]) continue;
    count += 1;
    sum += Math.abs(canvas.data[i]! - blobReference.data[i]! * 255);
    sumIfMissing += Math.abs(plainReference.data[i]! - blobReference.data[i]!) * 255;
  }
  expect(count).toBeGreaterThan(20);
  expect(sumIfMissing / count).toBeGreaterThan(20);
  expect(sum / count, 'mean difference over the blob pixels').toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);
  expect(sum / count).toBeLessThan(sumIfMissing / count / 4);
});

test('the blob centre is at least 20 grey levels darker, and a pixel far from it is unchanged', async ({ page }) => {
  await takeImage(page);
  const without = await readWholeCanvas(page);
  await setContrast(page, blob());
  await takeImage(page);
  const withBlob = await readWholeCanvas(page);

  const at = (canvas: { data: Uint8Array }, p: { x: number; y: number }): number => canvas.data[p.x + 512 * p.y]!;
  expect(crossesBlob[blobPixel.x + 512 * blobPixel.y]).toBe(1);
  expect(crossesBlob[farPixel.x + 512 * farPixel.y]).toBe(0);
  expect(at(without, farPixel)).toBeLessThan(250); // inside the body, not air
  expect(at(without, blobPixel) - at(withBlob, blobPixel)).toBeGreaterThanOrEqual(20);
  expect(Math.abs(at(withBlob, farPixel) - at(without, farPixel))).toBeLessThanOrEqual(1);

  // Every pixel whose ray does not cross the blob is unchanged; no crossing pixel got lighter.
  let changedElsewhere = 0;
  let lighter = 0;
  for (let i = 0; i < without.data.length; i++) {
    if (crossesBlob[i]) {
      if (withBlob.data[i]! > without.data[i]!) lighter += 1;
    } else if (Math.abs(withBlob.data[i]! - without.data[i]!) > 1) {
      changedElsewhere += 1;
    }
  }
  expect(changedElsewhere).toBe(0);
  expect(lighter).toBe(0);
});

test('putting contrast in the store without taking an image leaves the canvas unchanged', async ({ page }) => {
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await setContrast(page, blob());
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
  // Re-displaying the held image (Invert on and off) does not bring the contrast in either.
  await setRenderSettings(page, { invert: true });
  await setRenderSettings(page, { invert: false });
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('after the contrast is set back to none, the next image equals the image without contrast', async ({ page }) => {
  await takeImage(page);
  const without = await readWholeCanvas(page);
  await setContrast(page, blob());
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), without)).toBe(false);
  await setContrast(page, null);
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), without)).toBe(true);
});

test('a new contrast array replaces the old one on the next image', async ({ page }) => {
  await setContrast(page, new Uint8Array(voxels)); // all zero: no effect
  await takeImage(page);
  const empty = await readWholeCanvas(page);
  expect(meanDifference(empty, plainReference)).toBeLessThanOrEqual(1);
  await setContrast(page, blob());
  await takeImage(page);
  const withBlob = await readWholeCanvas(page);
  expect(empty.data[blobPixel.x + 512 * blobPixel.y]! - withBlob.data[blobPixel.x + 512 * blobPixel.y]!).toBeGreaterThanOrEqual(
    20,
  );
});
