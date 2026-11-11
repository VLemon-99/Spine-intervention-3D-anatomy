// F2.4: the 1×, 1.5× and 2× buttons in the fluoro panel.
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { expectOnScreen, getRenderInfo, press, readWholeCanvas, setRenderSettings } from './renderPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const BUTTONS = ['magnification-1x', 'magnification-1.5x', 'magnification-2x'] as const;
const BODY = PHANTOM_TEST_POINTS.blockCentres.upper;
/** Soft tissue beside the bones, at the same height as the upper vertebra body. */
const SOFT = { x: 30, y: BODY.y, z: BODY.z };

/** Where a patient point appears in the image at magnification m (default pose). */
function imagePixel(point: { x: number; y: number; z: number }, m: number): { x: number; y: number } {
  const p = createProjection(DEFAULT_POSE).project(point);
  return { x: Math.floor(256 + (p.x - 256) * m), y: Math.floor(256 + (p.y - 256) * m) };
}

/**
 * Width in pixels of the upper vertebra body's dark band along its image row
 * on the canvas: pixels darker than halfway between soft tissue and bone.
 */
async function bodyWidthOnCanvas(page: Page, m: number): Promise<number> {
  const canvas = await readWholeCanvas(page);
  const at = (p: { x: number; y: number }): number => canvas.data[p.x + canvas.width * p.y]!;
  const body = imagePixel(BODY, m);
  const boneValue = at(body);
  const softValue = at(imagePixel(SOFT, m));
  expect(boneValue).toBeLessThan(softValue - 10);
  const threshold = (boneValue + softValue) / 2;
  let width = 0;
  for (let x = 0; x < canvas.width; x++) if (at({ x, y: body.y }) < threshold) width += 1;
  // The band lies inside the image.
  expect(at({ x: 0, y: body.y })).toBeGreaterThan(threshold);
  expect(at({ x: canvas.width - 1, y: body.y })).toBeGreaterThan(threshold);
  return width;
}

async function pressedStates(page: Page): Promise<(string | null)[]> {
  return Promise.all(BUTTONS.map((id) => page.getByTestId(id).getAttribute('aria-pressed')));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('pressing 2× sets the magnification to 2 and only that button is pressed', async ({ page }) => {
  expect(await pressedStates(page)).toEqual(['true', 'false', 'false']);
  for (const id of BUTTONS) expect(await page.getByTestId(id).evaluate((b) => b.tagName)).toBe('BUTTON');
  await expect(page.getByTestId('magnification-1x')).toHaveText('1×');
  await expect(page.getByTestId('magnification-1.5x')).toHaveText('1.5×');
  await expect(page.getByTestId('magnification-2x')).toHaveText('2×');

  await press(page, 'magnification-2x');
  expect((await getRenderInfo(page)).settings.magnification).toBe(2);
  expect(await pressedStates(page)).toEqual(['false', 'false', 'true']);

  await press(page, 'magnification-1.5x');
  expect((await getRenderInfo(page)).settings.magnification).toBe(1.5);
  expect(await pressedStates(page)).toEqual(['false', 'true', 'false']);

  await press(page, 'magnification-1x');
  expect((await getRenderInfo(page)).settings.magnification).toBe(1);
  expect(await pressedStates(page)).toEqual(['true', 'false', 'false']);

  // Pressing a magnification button never takes an image.
  expect((await getSimState(page)).shotCount).toBe(0);
});

test('the buttons follow the setting when it is changed elsewhere', async ({ page }) => {
  await setRenderSettings(page, { magnification: 1.5 });
  await expect(page.getByTestId('magnification-1.5x')).toHaveAttribute('aria-pressed', 'true');
  expect(await pressedStates(page)).toEqual(['false', 'true', 'false']);
});

test('an image taken after pressing 2× shows the vertebra body about twice as wide as at 1×', async ({ page }) => {
  await setRenderSettings(page, { noiseLevel: 0 });
  await takeImage(page);
  const width1 = await bodyWidthOnCanvas(page, 1);
  expect(width1).toBeGreaterThan(30);

  await press(page, 'magnification-2x');
  // Not yet: magnification shows on the next image.
  expect(await bodyWidthOnCanvas(page, 1)).toBe(width1);
  await takeImage(page);
  const width2 = await bodyWidthOnCanvas(page, 2);
  expect(Math.abs(width2 / width1 - 2) / 2, `widths ${width1} and ${width2}`).toBeLessThanOrEqual(0.1);
});

test('the three buttons and the canvas are visible without scrolling, and each button is at least 44×44 px', async ({
  page,
}) => {
  const panel = page.getByTestId('fluoro-panel');
  const canvasBox = await expectOnScreen(page, panel.getByTestId('fluoro-canvas'));
  expect(canvasBox.width).toBeGreaterThanOrEqual(200);
  const c = (await panel.getByTestId('fluoro-canvas').boundingBox())!;
  for (const id of BUTTONS) {
    const box = await expectOnScreen(page, panel.getByTestId(id));
    expect(box.width, id).toBeGreaterThanOrEqual(44);
    expect(box.height, id).toBeGreaterThanOrEqual(44);
    const b = (await panel.getByTestId(id).boundingBox())!;
    const overlap = b.x < c.x + c.width && c.x < b.x + b.width && b.y < c.y + c.height && c.y < b.y + b.height;
    expect(overlap, `${id} lies on the picture`).toBe(false);
  }
});
