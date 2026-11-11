// F8.1: the 3D view toggle and the bone surface in the 3D scene.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { countNonBackgroundPixels, expectOnScreen, getView3d, press, putTestVolume, sceneObject } from './view3dPage';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('at start the 3D view is off and its canvas is hidden', async ({ page }) => {
  const info = await getView3d(page);
  expect(info.shown).toBe(false);
  expect(info.toggleEnabled).toBe(true);
  await expect(page.getByTestId('view3d-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('view3d-canvas')).toBeHidden();
});

test('the toggle turns the view on and shows the bone surface', async ({ page }) => {
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();

  const info = await getView3d(page);
  expect(info.shown).toBe(true);
  const bone = sceneObject(info, 'bone');
  expect(bone, JSON.stringify(info.objects)).toBeDefined();
  expect(bone!.visible).toBe(true);
  expect(bone!.triangles).toBeGreaterThan(0);

  // The bone is really drawn: some pixels differ from the background.
  await expect.poll(() => countNonBackgroundPixels(page), { timeout: 10_000 }).toBeGreaterThan(100);
});

test('a second click or tap turns the view off again', async ({ page }) => {
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('view3d-canvas')).toBeHidden();
  expect((await getView3d(page)).shown).toBe(false);
});

test('a different volume in the store changes the bone triangle count', async ({ page }) => {
  await press(page, 'view3d-toggle');
  const before = sceneObject(await getView3d(page), 'bone')!.triangles;

  // One bone voxel: 6 faces, 12 triangles.
  await putTestVolume(page, 5, [[2, 2, 2]]);
  await expect.poll(async () => sceneObject(await getView3d(page), 'bone')?.triangles).toBe(12);
  expect(before).not.toBe(12);

  // Two neighbouring voxels: 20 triangles.
  await putTestVolume(page, 5, [
    [2, 2, 2],
    [3, 2, 2],
  ]);
  await expect.poll(async () => sceneObject(await getView3d(page), 'bone')?.triangles).toBe(20);
});

test('the start camera looks at the middle of the volume', async ({ page }) => {
  await press(page, 'view3d-toggle');
  await putTestVolume(page, 5, [[2, 2, 2]]);
  await expect.poll(async () => sceneObject(await getView3d(page), 'bone')?.triangles).toBe(12);
  const { camera } = await getView3d(page);
  // The test volume is centred on the isocentre.
  expect(Math.hypot(camera.target.x, camera.target.y, camera.target.z)).toBeLessThan(0.01);
  const distance = Math.hypot(
    camera.position.x - camera.target.x,
    camera.position.y - camera.target.y,
    camera.position.z - camera.target.z,
  );
  // Far enough to see the whole 5 mm volume, not lost in the distance.
  expect(distance).toBeGreaterThan(4);
  expect(distance).toBeLessThan(50);
});

test('the toggle is at least 44×44 px and visible without scrolling', async ({ page }) => {
  const box = await expectOnScreen(page, page.getByTestId('view3d-panel').getByTestId('view3d-toggle'));
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  // Also with the view on, and the canvas stays inside the panel.
  await press(page, 'view3d-toggle');
  const on = await expectOnScreen(page, page.getByTestId('view3d-toggle'));
  expect(on.width).toBeGreaterThanOrEqual(44);
  expect(on.height).toBeGreaterThanOrEqual(44);
  const canvas = await expectOnScreen(page, page.getByTestId('view3d-canvas'));
  expect(canvas.width).toBeGreaterThanOrEqual(150);
  expect(canvas.height).toBeGreaterThanOrEqual(150);
  const panel = (await page.getByTestId('view3d-panel').boundingBox())!;
  const c = (await page.getByTestId('view3d-canvas').boundingBox())!;
  expect(c.y + c.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
});
