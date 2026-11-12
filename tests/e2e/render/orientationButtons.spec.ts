// F2.7: the Flip ↔, Flip ↕ and Rotate buttons in the fluoro panel.
import { expect, test } from '@playwright/test';
import type { CArmPose } from '../../../src/core/types';
import { orientPixel, type Orientation } from '../../../src/render/orientation';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { expectOnScreen, getRenderInfo, press, readWholeCanvas, setRenderSettings } from './renderPage';

// A pose whose picture has no left-right or up-down symmetry.
const POSE: CArmPose = { oblique: 30, tilt: 15, tableLeftRight: 20, tableHeadFoot: -15, tableHeight: 0 };
const NONE: Orientation = { flipHorizontal: false, flipVertical: false, rotation: 0 };
const BUTTONS = ['flip-horizontal', 'flip-vertical', 'rotate-button'] as const;

/** Largest difference between the canvas `now` and the canvas `before` moved as the orientation says. */
function worstAfterMove(now: Uint8Array, before: Uint8Array, orientation: Orientation): number {
  let worst = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const to = orientPixel({ x, y }, orientation);
      worst = Math.max(worst, Math.abs(now[to.x + 512 * to.y]! - before[x + 512 * y]!));
    }
  }
  return worst;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
  await setPose(page, POSE);
  await takeImage(page);
});

test('Flip ↔ mirrors the picture left-right at once; pressing again restores it', async ({ page }) => {
  const button = page.getByTestId('flip-horizontal');
  expect(await button.evaluate((b) => b.tagName)).toBe('BUTTON');
  await expect(button).toHaveText('Flip ↔');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  const before = (await readWholeCanvas(page)).data;
  const mirrored: Orientation = { ...NONE, flipHorizontal: true };
  expect(worstAfterMove(before, before, mirrored)).toBeGreaterThan(50); // the picture is not symmetric

  await press(page, 'flip-horizontal');
  expect((await getRenderInfo(page)).settings.flipHorizontal).toBe(true);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(worstAfterMove((await readWholeCanvas(page)).data, before, mirrored)).toBeLessThanOrEqual(1);

  await press(page, 'flip-horizontal');
  expect((await getRenderInfo(page)).settings.flipHorizontal).toBe(false);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(worstAfterMove((await readWholeCanvas(page)).data, before, NONE)).toBeLessThanOrEqual(1);
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('Flip ↕ mirrors the picture up-down at once; pressing again restores it', async ({ page }) => {
  const button = page.getByTestId('flip-vertical');
  expect(await button.evaluate((b) => b.tagName)).toBe('BUTTON');
  await expect(button).toHaveText('Flip ↕');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  const before = (await readWholeCanvas(page)).data;
  const mirrored: Orientation = { ...NONE, flipVertical: true };
  expect(worstAfterMove(before, before, mirrored)).toBeGreaterThan(50);

  await press(page, 'flip-vertical');
  expect((await getRenderInfo(page)).settings.flipVertical).toBe(true);
  expect((await getRenderInfo(page)).settings.flipHorizontal).toBe(false);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(worstAfterMove((await readWholeCanvas(page)).data, before, mirrored)).toBeLessThanOrEqual(1);

  await press(page, 'flip-vertical');
  expect((await getRenderInfo(page)).settings.flipVertical).toBe(false);
  expect(worstAfterMove((await readWholeCanvas(page)).data, before, NONE)).toBeLessThanOrEqual(1);
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('Rotate adds 90° clockwise per press, wraps back to 0° and shows the angle', async ({ page }) => {
  const button = page.getByTestId('rotate-button');
  expect(await button.evaluate((b) => b.tagName)).toBe('BUTTON');
  await expect(button).toContainText('Rotate');
  await expect(button).toContainText('0°');
  const before = (await readWholeCanvas(page)).data;

  for (const rotation of [90, 180, 270, 0] as const) {
    await press(page, 'rotate-button');
    expect((await getRenderInfo(page)).settings.rotation).toBe(rotation);
    await expect(button).toContainText(`${rotation}°`);
    expect(worstAfterMove((await readWholeCanvas(page)).data, before, { ...NONE, rotation })).toBeLessThanOrEqual(1);
  }
  expect((await getSimState(page)).shotCount).toBe(1);
});

test('the buttons follow the settings when they change elsewhere', async ({ page }) => {
  await setRenderSettings(page, { flipHorizontal: true, flipVertical: true, rotation: 270 });
  await expect(page.getByTestId('flip-horizontal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('flip-vertical')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rotate-button')).toContainText('270°');
});

test('the three buttons and the canvas are visible without scrolling, and each button is at least 44×44 px', async ({
  page,
}) => {
  const panel = page.getByTestId('fluoro-panel');
  const canvas = panel.getByTestId('fluoro-canvas');
  const canvasBox = await expectOnScreen(page, canvas);
  expect(canvasBox.width).toBeGreaterThanOrEqual(200);
  const c = (await canvas.boundingBox())!;
  const boxes = [];
  for (const id of BUTTONS) {
    const box = await expectOnScreen(page, panel.getByTestId(id));
    expect(box.width, id).toBeGreaterThanOrEqual(44);
    expect(box.height, id).toBeGreaterThanOrEqual(44);
    const b = (await panel.getByTestId(id).boundingBox())!;
    const overlap = b.x < c.x + c.width && c.x < b.x + b.width && b.y < c.y + c.height && c.y < b.y + b.height;
    expect(overlap, `${id} lies on the picture`).toBe(false);
    boxes.push(b);
  }
  // Still true with the collimation sliders folded out.
  await press(page, 'collimation-toggle');
  for (const id of [...BUTTONS, 'collimation-bottom', 'invert-toggle', 'magnification-2x']) {
    await expectOnScreen(page, panel.getByTestId(id));
  }
  expect((await expectOnScreen(page, canvas)).width).toBeGreaterThanOrEqual(200);
});
