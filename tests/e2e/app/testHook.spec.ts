import { expect, test } from '@playwright/test';
import { PHANTOM_SIZE } from '../../../src/core/phantom';
import type { SimHook } from '../../../src/core/testHook';

type HookState = ReturnType<SimHook['getState']>;

const getState = async (page: import('@playwright/test').Page): Promise<HookState> => {
  await page.waitForFunction(() => 'getState' in ((window as { __sim?: object }).__sim ?? {}));
  return page.evaluate(() => (window as unknown as { __sim: SimHook }).__sim.getState());
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('window.__sim.getState() starts with the default pose, no shots and no last image', async ({ page }) => {
  const state = await getState(page);
  expect(state.pose).toEqual({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
  expect(state.shotCount).toBe(0);
  expect(state.lastImagePose).toBeNull();
});

test('window.__sim.getState() reports the phantom as the current volume', async ({ page }) => {
  const state = await getState(page);
  expect(state.volume).toEqual({ region: 'phantom', size: { x: PHANTOM_SIZE, y: PHANTOM_SIZE, z: PHANTOM_SIZE } });
});
