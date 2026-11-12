// F8.3: orbit with one finger and zoom with a pinch (tablet).
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { oneFingerDrag, pinch } from './touch';
import { cameraDistance, getView3d, makePageScrollable, pageScrollAndZoom, press } from './view3dPage';

test.describe('touch orbit and pinch zoom', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only (the mouse is in orbitMouse.spec.ts)');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await press(page, 'view3d-toggle');
    await expect(page.getByTestId('view3d-canvas')).toBeVisible();
  });

  async function canvasCentre(page: import('@playwright/test').Page): Promise<{ x: number; y: number }> {
    const box = (await page.getByTestId('view3d-canvas').boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  test('a one-finger drag orbits: the camera moves and keeps its distance to the target', async ({ page }) => {
    const before = await getView3d(page);
    const c = await canvasCentre(page);
    await oneFingerDrag(page, { x: c.x - 60, y: c.y - 20 }, { x: c.x + 60, y: c.y + 30 });

    const after = await getView3d(page);
    const moved = Math.hypot(
      after.camera.position.x - before.camera.position.x,
      after.camera.position.y - before.camera.position.y,
      after.camera.position.z - before.camera.position.z,
    );
    expect(moved).toBeGreaterThan(1);
    expect(Math.abs(cameraDistance(after) - cameraDistance(before)) / cameraDistance(before)).toBeLessThan(0.01);
    expect(after.camera.target).toEqual(before.camera.target);
  });

  test('pinching apart zooms in; pinching together zooms out', async ({ page }) => {
    const c = await canvasCentre(page);
    const start = cameraDistance(await getView3d(page));

    await pinch(page, c, 40, 200);
    const closer = cameraDistance(await getView3d(page));
    expect(closer).toBeLessThan(start);

    await pinch(page, c, 200, 40);
    expect(cameraDistance(await getView3d(page))).toBeGreaterThan(closer);
  });

  test('the page does not scroll or zoom during the gestures', async ({ page }) => {
    await makePageScrollable(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);

    const c = await canvasCentre(page);
    const start = await getView3d(page);
    // A drag that would scroll the page upward, and two pinches that would zoom it.
    await oneFingerDrag(page, { x: c.x, y: c.y + 60 }, { x: c.x + 10, y: c.y - 80 });
    await pinch(page, c, 40, 200);
    await pinch(page, c, 200, 60);

    // The gestures reached the 3D view …
    const after = await getView3d(page);
    expect(after.camera.position).not.toEqual(start.camera.position);
    // … and not the page.
    expect(await pageScrollAndZoom(page)).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
