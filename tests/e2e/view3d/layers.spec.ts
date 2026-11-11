// F8.4: the four soft-tissue layer objects in the 3D scene.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { getView3d, press, sceneObject } from './view3dPage';

const LAYER_OBJECTS = ['layer-nerves', 'layer-vessels', 'layer-thecal', 'layer-soft'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
});

test('the four layer objects are in the scene, each with triangles on the phantom', async ({ page }) => {
  const info = await getView3d(page);
  for (const name of LAYER_OBJECTS) {
    const object = sceneObject(info, name);
    expect(object, `${name} in ${JSON.stringify(info.objects)}`).toBeDefined();
    expect(object!.triangles, name).toBeGreaterThan(0);
  }
});

test('at start nerves, vessels and thecal sac are visible and soft tissue is not', async ({ page }) => {
  const info = await getView3d(page);
  expect(sceneObject(info, 'layer-nerves')!.visible).toBe(true);
  expect(sceneObject(info, 'layer-vessels')!.visible).toBe(true);
  expect(sceneObject(info, 'layer-thecal')!.visible).toBe(true);
  expect(sceneObject(info, 'layer-soft')!.visible).toBe(false);
  // Bone stays shown.
  expect(sceneObject(info, 'bone')!.visible).toBe(true);
});
