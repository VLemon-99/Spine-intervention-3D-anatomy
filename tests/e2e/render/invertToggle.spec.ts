// F2.3: the Invert button in the fluoro panel.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { expectOnScreen, getRenderInfo, press, setRenderSettings } from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const CORNER = { x: 0, y: 0 };
// The vertebra pixel from F0.6: the projected centre of the upper vertebra block.
const blockPixel = createProjection(DEFAULT_POSE).project(PHANTOM_TEST_POINTS.blockCentres.upper);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('pressing Invert makes the vertebra lighter than the corner; pressing again makes it darker again', async ({
  page,
}) => {
  await takeImage(page);
  let [block, corner] = await readCanvas(page, [blockPixel, CORNER]);
  expect(block!).toBeLessThan(corner!);

  await press(page, 'invert-toggle');
  [block, corner] = await readCanvas(page, [blockPixel, CORNER]);
  expect(block!, `inverted: block ${block}, corner ${corner}`).toBeGreaterThan(corner!);

  await press(page, 'invert-toggle');
  [block, corner] = await readCanvas(page, [blockPixel, CORNER]);
  expect(block!, `back to normal: block ${block}, corner ${corner}`).toBeLessThan(corner!);

  // Pressing the button never takes an image.
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('aria-pressed shows the state and matches the setting', async ({ page }) => {
  const button = page.getByTestId('invert-toggle');
  expect(await button.evaluate((b) => b.tagName)).toBe('BUTTON');
  await expect(button).toHaveText('Invert');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect((await getRenderInfo(page)).settings.invert).toBe(false);

  await press(page, 'invert-toggle');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect((await getRenderInfo(page)).settings.invert).toBe(true);

  await press(page, 'invert-toggle');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect((await getRenderInfo(page)).settings.invert).toBe(false);
});

test('the button follows the setting when it is changed elsewhere', async ({ page }) => {
  const button = page.getByTestId('invert-toggle');
  await setRenderSettings(page, { invert: true });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await setRenderSettings(page, { invert: false });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('the button and the canvas are visible without scrolling, and the button is at least 44×44 px', async ({
  page,
}) => {
  const panel = page.getByTestId('fluoro-panel');
  const button = panel.getByTestId('invert-toggle');
  const canvas = panel.getByTestId('fluoro-canvas');
  const buttonBox = await expectOnScreen(page, button);
  const canvasBox = await expectOnScreen(page, canvas);
  expect(buttonBox.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  // The picture must stay a usable size beside the controls.
  expect(canvasBox.width).toBeGreaterThanOrEqual(200);
  expect(canvasBox.height).toBeGreaterThanOrEqual(200);
  // The button does not lie on top of the picture.
  const b = (await button.boundingBox())!;
  const c = (await canvas.boundingBox())!;
  const overlap = b.x < c.x + c.width && c.x < b.x + b.width && b.y < c.y + c.height && c.y < b.y + b.height;
  expect(overlap).toBe(false);
});
