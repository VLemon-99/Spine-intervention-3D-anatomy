import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { defaultRenderSettings } from '../../../src/render/settings';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { getRenderInfo, setRenderSettings } from './renderPage';

// The defaults as the settings module defines them (F2-S13 changes the default
// noise level, so they are not written out here).
const DEFAULT_SETTINGS = defaultRenderSettings();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('before the first image, render() reports the default settings and no last image', async ({ page }) => {
  const info = await getRenderInfo(page);
  expect(info.settings).toEqual(DEFAULT_SETTINGS);
  expect(info.settings.invert).toBe(false);
  expect(info.settings.magnification).toBe(1);
  expect(info.settings.collimation).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  expect(info.settings.rotation).toBe(0);
  expect(info.lastImage).toBeNull();
});

test('each image remembers its pose, its settings and its noise seed (1, 2, …)', async ({ page }) => {
  await setPose(page, { oblique: 20, tilt: -10 });
  await setRenderSettings(page, { magnification: 2 });
  expect((await getRenderInfo(page)).settings.magnification).toBe(2);
  expect((await getRenderInfo(page)).lastImage).toBeNull();

  await takeImage(page);
  const first = await getRenderInfo(page);
  const state = await getSimState(page);
  expect(state.lastImagePose).not.toBeNull();
  expect(first.lastImage?.pose).toEqual(state.lastImagePose);
  expect(first.lastImage?.pose.oblique).toBe(20);
  expect(first.lastImage?.settings.magnification).toBe(2);
  expect(first.lastImage?.noiseSeed).toBe(1);

  await takeImage(page);
  expect((await getRenderInfo(page)).lastImage?.noiseSeed).toBe(2);
});

test('changing a setting after an image does not change what the image remembers', async ({ page }) => {
  await takeImage(page);
  await setRenderSettings(page, { magnification: 1.5, collimation: { left: 20 } });
  const info = await getRenderInfo(page);
  expect(info.settings.magnification).toBe(1.5);
  expect(info.settings.collimation.left).toBe(20);
  expect(info.lastImage?.settings).toEqual(DEFAULT_SETTINGS);
  expect(info.lastImage?.noiseSeed).toBe(1);
});

test('setRenderSettings is validated like any other change', async ({ page }) => {
  await setRenderSettings(page, { noiseLevel: 5, collimation: { top: 80 } });
  const { settings } = await getRenderInfo(page);
  expect(settings.noiseLevel).toBe(1);
  expect(settings.collimation.top).toBe(50);
});
