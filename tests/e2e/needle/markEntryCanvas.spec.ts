// F5-S11: end to end, a click (desktop) or tap (tablet) on the real fluoro
// canvas with Mark entry on puts the entry on the skin under that pixel (F5.2),
// through the render zone's real 'imageTap' event.
import { expect, test, type Page } from '@playwright/test';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { readNeedle, waitForVolume } from './needlePage';

const isTablet = () => test.info().project.use.hasTouch === true;

async function press(page: Page, testId: string): Promise<void> {
  const target = page.getByTestId(testId);
  if (isTablet()) await target.tap();
  else await target.click();
}

/** Click or tap the fluoro canvas at image pixel (x, y) with the default display settings (no flips, 1×). */
async function tapImagePixel(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId('fluoro-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas box');
  const position = { x: (box.width * x) / 512, y: (box.height * y) / 512 };
  if (isTablet()) await canvas.tap({ position });
  else await canvas.click({ position });
}

interface EntryCheck {
  entryIsAir: boolean;
  outerIsAir: boolean;
  projected: { x: number; y: number };
}

/** Checks the marked entry against the volume and the image's geometry, in the page. */
function checkEntry(page: Page, pixel: { x: number; y: number }): Promise<EntryCheck> {
  return page.evaluate(async (pixel) => {
    const mods = ['/src/core/store.ts', '/src/core/geometry.ts', '/src/needle/sample.ts', '/src/core/labels.ts'];
    const [{ store }, { createProjection }, { labelAt }, { TISSUE }] = (await Promise.all(
      mods.map((m) => import(/* @vite-ignore */ m)),
    )) as [
      typeof import('../../../src/core/store'),
      typeof import('../../../src/core/geometry'),
      typeof import('../../../src/needle/sample'),
      typeof import('../../../src/core/labels'),
    ];
    const { volume, lastImagePose, needle } = store.get();
    if (!volume || !lastImagePose || !needle) throw new Error('missing volume, image or needle');
    const projection = createProjection(lastImagePose as CArmPose);
    const ray = projection.unproject(pixel);
    const e = needle.entryPoint;
    const voxel = Math.min(volume.spacing.x, volume.spacing.y, volume.spacing.z);
    const outer = { x: e.x + ray.direction.x * voxel, y: e.y + ray.direction.y * voxel, z: e.z + ray.direction.z * voxel };
    return {
      entryIsAir: labelAt(volume, e) === TISSUE.air,
      outerIsAir: labelAt(volume, outer) === TISSUE.air,
      projected: projection.project(e),
    };
  }, pixel);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
});

test('tapping the fluoro canvas at pixel (256, 256) with Mark entry on marks the skin under that pixel', async ({ page }) => {
  expect((await getSimState(page)).pose).toMatchObject({ oblique: 0, tilt: 0 });
  await takeImage(page);
  await press(page, 'mark-entry');
  await expect(page.getByTestId('mark-entry')).toHaveAttribute('aria-pressed', 'true');
  await tapImagePixel(page, 256, 256);

  await expect.poll(() => readNeedle(page)).not.toBeNull();
  const needle = await readNeedle(page);
  expect(needle!.entryPoint.y).toBeGreaterThan(30); // the back
  const c = await checkEntry(page, { x: 256, y: 256 });
  expect(c.entryIsAir).toBe(false);
  expect(c.outerIsAir).toBe(true); // the skin boundary, within 1 voxel
  expect(Math.hypot(c.projected.x - 256, c.projected.y - 256)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('mark-entry')).toHaveAttribute('aria-pressed', 'false');
});
