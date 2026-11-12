// F8.3: orbit and zoom the 3D view with the mouse (desktop).
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { cameraDistance, getView3d, makePageScrollable, pageScrollAndZoom, press } from './view3dPage';

test.describe('mouse orbit and zoom', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only (the tablet gestures are in orbitTouch.spec.ts)');

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

  test('a mouse drag orbits: the camera moves and keeps its distance to the target', async ({ page }) => {
    const before = await getView3d(page);
    const c = await canvasCentre(page);
    await page.mouse.move(c.x - 60, c.y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) await page.mouse.move(c.x - 60 + step * 20, c.y + step * 8);
    await page.mouse.up();

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

  test('wheel steps toward the screen zoom in; steps the other way zoom out', async ({ page }) => {
    const c = await canvasCentre(page);
    await page.mouse.move(c.x, c.y);
    const start = cameraDistance(await getView3d(page));

    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
    await expect.poll(async () => cameraDistance(await getView3d(page))).toBeLessThan(start);
    const closer = cameraDistance(await getView3d(page));

    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 100);
    await expect.poll(async () => cameraDistance(await getView3d(page))).toBeGreaterThan(closer);
  });

  test('the page does not scroll while wheeling over the canvas', async ({ page }) => {
    await makePageScrollable(page);
    // The page really can scroll now.
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);

    const c = await canvasCentre(page);
    await page.mouse.move(c.x, c.y);
    const start = cameraDistance(await getView3d(page));
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 120);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);
    await expect.poll(async () => cameraDistance(await getView3d(page))).not.toBe(start);
    expect(await pageScrollAndZoom(page)).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
