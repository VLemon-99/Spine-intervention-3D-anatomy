// F8.1, F8.2: the needle in the 3D scene follows the needle state.
import { expect, test } from '@playwright/test';
import type { Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { getView3d, press, putNeedle, sceneObject, testNeedle } from './view3dPage';

const TOLERANCE_MM = 0.5;

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// A straight shaft from behind the back (+y) toward the vertebra.
const STRAIGHT: Vec3[] = [
  { x: 20, y: 80, z: 5 },
  { x: 15, y: 60, z: 4 },
  { x: 10, y: 40, z: 3 },
];
// Deeper and bent toward the midline.
const BENT: Vec3[] = [
  { x: 20, y: 80, z: 5 },
  { x: 15, y: 60, z: 4 },
  { x: 9, y: 40, z: 3 },
  { x: 4, y: 22, z: 2.5 },
  { x: 0.5, y: 6, z: 2 },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
});

test('with no needle in the store, the needle object is not visible', async ({ page }) => {
  const info = await getView3d(page);
  expect(info.shown).toBe(true);
  const needle = sceneObject(info, 'needle');
  expect(needle, JSON.stringify(info.objects)).toBeDefined();
  expect(needle!.visible).toBe(false);
  expect(info.needle).toBeNull();
});

test('the needle object follows the needle state, and hides again for no needle', async ({ page }) => {
  await putNeedle(page, testNeedle(STRAIGHT));
  await expect.poll(async () => sceneObject(await getView3d(page), 'needle')?.visible).toBe(true);
  let info = await getView3d(page);
  expect(info.needle).not.toBeNull();
  expect(distance(info.needle!.hub, STRAIGHT[0]!)).toBeLessThan(TOLERANCE_MM);
  expect(distance(info.needle!.tip, STRAIGHT[STRAIGHT.length - 1]!)).toBeLessThan(TOLERANCE_MM);

  // A deeper, bent shaft.
  await putNeedle(page, testNeedle(BENT));
  await expect
    .poll(async () => {
      const n = (await getView3d(page)).needle;
      return n ? distance(n.tip, BENT[BENT.length - 1]!) : Infinity;
    })
    .toBeLessThan(TOLERANCE_MM);
  info = await getView3d(page);
  expect(sceneObject(info, 'needle')!.visible).toBe(true);
  expect(distance(info.needle!.hub, BENT[0]!)).toBeLessThan(TOLERANCE_MM);

  // Back to no needle.
  await putNeedle(page, null);
  await expect.poll(async () => sceneObject(await getView3d(page), 'needle')?.visible).toBe(false);
  expect((await getView3d(page)).needle).toBeNull();
});
