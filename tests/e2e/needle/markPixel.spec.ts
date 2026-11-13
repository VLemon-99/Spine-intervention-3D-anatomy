// F5-S12: marking the entry from an image pixel (F5.2 logic, F5.3).
import { expect, test, type Page } from '@playwright/test';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { advanceNeedle, markEntryAtPixel, readNeedle, waitForVolume } from './needlePage';

interface EntryCheck {
  entry: Vec3;
  entryIsAir: boolean;
  outerIsAir: boolean;
  projected: { x: number; y: number };
  source: Vec3;
}

/** Checks the marked entry against the volume and the last image's geometry, in the page. */
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
      entry: e,
      entryIsAir: labelAt(volume, e) === TISSUE.air,
      outerIsAir: labelAt(volume, outer) === TISSUE.air,
      projected: projection.project(e),
      source: projection.source,
    };
  }, pixel);
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
});

test('before the first image markEntryAtPixel does nothing', async ({ page }) => {
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).not.toBe('ok');
  expect(await readNeedle(page)).toBeNull();
});

for (const { pose, pixel } of [
  { pose: { oblique: 0, tilt: 0 }, pixel: { x: 256, y: 256 } },
  { pose: { oblique: 20, tilt: 0 }, pixel: { x: 240, y: 270 } },
]) {
  test(`at oblique ${pose.oblique}° pixel (${pixel.x}, ${pixel.y}) marks the back skin under that pixel`, async ({ page }) => {
    await setPose(page, pose);
    await takeImage(page);
    expect(await markEntryAtPixel(page, pixel)).toBe('ok');
    const c = await checkEntry(page, pixel);
    expect(c.entry.y).toBeGreaterThan(30); // the back, not the belly
    expect(c.entryIsAir).toBe(false);
    expect(c.outerIsAir).toBe(true);
    expect(Math.hypot(c.projected.x - pixel.x, c.projected.y - pixel.y)).toBeLessThanOrEqual(2);
  });
}

test('right after marking the tip is the entry point and advancing 5 mm moves it toward the source', async ({ page }) => {
  await takeImage(page);
  await markEntryAtPixel(page, { x: 256, y: 256 });
  const needle = await readNeedle(page);
  if (!needle) throw new Error('no needle');
  expect(needle.tip).toEqual(needle.entryPoint);
  const { source } = await checkEntry(page, { x: 256, y: 256 });
  expect(await advanceNeedle(page, 5)).toBe('ok');
  const after = await readNeedle(page);
  if (!after) throw new Error('no needle');
  expect(dist(needle.tip, source) - dist(after.tip, source)).toBeGreaterThan(4.9);
});
