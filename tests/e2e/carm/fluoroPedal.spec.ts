// F3-S11: continuous fluoro while the on-screen Fluoro pedal is held, with the
// mouse (desktop) or a finger (tablet) (F3.4).
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas, type PixelPosition } from '../../fixtures/readCanvas';
import { getSimState } from '../../fixtures/simPage';
import { centreOf, dragSlider, touchScreen } from './controls';

type CarmDebug = { fluoroTimeSeconds: number; fluoroOn: boolean };
const carm = (page: Page): Promise<CarmDebug> =>
  page.evaluate(() => (window as unknown as { __sim: { carm(): CarmDebug } }).__sim.carm());

const PEDAL = 'fluoro-pedal';
const PEDAL_FINGER = 1;
const SLIDER_FINGER = 2;

/** Projected vertebra block centres at the given poses, plus a fixed 8×8 grid of points. */
function points(...poses: CArmPose[]): PixelPosition[] {
  const blocks = [PHANTOM_TEST_POINTS.blockCentres.upper, PHANTOM_TEST_POINTS.blockCentres.lower];
  const projected = poses.flatMap((pose) => blocks.map((b) => createProjection(pose).project(b)));
  const grid: PixelPosition[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) grid.push({ x: 32 + i * 64, y: 32 + j * 64 });
  return [...projected, ...grid].filter((p) => p.x >= 0 && p.x < 512 && p.y >= 0 && p.y < 512);
}

const difference = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);

/** Wait until the image on screen is of the current pose, then two more animation frames. */
async function waitForImageOfCurrentPose(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const state = await getSimState(page);
      return JSON.stringify(state.lastImagePose) === JSON.stringify(state.pose);
    })
    .toBe(true);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** Record the pedal's pointerdown / pointerup time stamps and pointer id in the page. */
async function recordPedalEvents(page: Page): Promise<void> {
  await page.getByTestId(PEDAL).evaluate((pedal: HTMLElement) => {
    const w = window as unknown as { __pedal: { down?: number; up?: number; pointerId?: number } };
    w.__pedal = {};
    pedal.addEventListener('pointerdown', (e) => {
      w.__pedal.down = e.timeStamp;
      w.__pedal.pointerId = e.pointerId;
    });
    pedal.addEventListener('pointerup', (e) => (w.__pedal.up = e.timeStamp));
  });
}

const pedalEvents = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pedal: { down: number; up: number; pointerId: number } }).__pedal);

/** Send a 'pointercancel' for the pointer that holds the pedal. */
async function cancelPedalPointer(page: Page): Promise<void> {
  await page.getByTestId(PEDAL).evaluate((pedal) => {
    const { pointerId } = (window as unknown as { __pedal: { pointerId: number } }).__pedal;
    pedal.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test.describe('tablet', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');

  test('while the pedal is held by touch, moving a slider changes the image without a Shot; after release it does not', async ({
    page,
  }) => {
    const ZERO: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
    // Fraction 0.75 of the oblique track is about +45°.
    const where = points(ZERO, { ...ZERO, oblique: 45 });
    const screen = await touchScreen(page);
    await screen.down(PEDAL_FINGER, await centreOf(page.getByTestId(PEDAL)));
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(true);
    await expect(page.getByTestId(PEDAL)).toHaveAttribute('aria-pressed', 'true');
    await waitForImageOfCurrentPose(page);
    const atZero = await readCanvas(page, where);

    // A second finger moves oblique while the first holds the pedal.
    await dragSlider(page, 'slider-oblique', 0.75, { screen, id: SLIDER_FINGER });
    expect((await getSimState(page)).pose.oblique).toBeGreaterThan(30);
    expect((await carm(page)).fluoroOn).toBe(true);
    await waitForImageOfCurrentPose(page);
    const atMoved = await readCanvas(page, where);
    expect(difference(atZero, atMoved)).toBeGreaterThan(100);
    expect((await getSimState(page)).shotCount).toBe(0);

    // Release the pedal: updates stop.
    await screen.up(PEDAL_FINGER);
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(false);
    await expect(page.getByTestId(PEDAL)).toHaveAttribute('aria-pressed', 'false');
    const held = await getSimState(page);
    const afterRelease = await readCanvas(page, where);
    await dragSlider(page, 'slider-tilt', 0.9, { screen, id: SLIDER_FINGER });
    expect((await getSimState(page)).pose.tilt).toBeGreaterThan(20);
    await page.waitForTimeout(500);
    expect(await readCanvas(page, where)).toEqual(afterRelease);
    expect((await getSimState(page)).lastImagePose).toEqual(held.lastImagePose);
    expect((await getSimState(page)).shotCount).toBe(0);
    await screen.close();
  });

  test('holding the pedal for about 3 s adds the time between pointerdown and pointerup (as seen in the page)', async ({
    page,
  }) => {
    await recordPedalEvents(page);
    const screen = await touchScreen(page);
    await screen.down(PEDAL_FINGER, await centreOf(page.getByTestId(PEDAL)));
    await page.waitForTimeout(3000);
    await screen.up(PEDAL_FINGER);
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(false);
    await screen.close();

    const { down, up } = await pedalEvents(page);
    const heldSeconds = (up - down) / 1000;
    expect(heldSeconds).toBeGreaterThan(2.5);
    const { fluoroTimeSeconds } = await carm(page);
    expect(Math.abs(fluoroTimeSeconds - heldSeconds)).toBeLessThanOrEqual(0.1 * heldSeconds);
    await expect(page.getByTestId('fluoro-time')).toHaveText(`${fluoroTimeSeconds.toFixed(1)} s`);
    expect((await getSimState(page)).shotCount).toBe(0);
  });
});

test.describe('desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test('holding the pedal with the mouse button runs fluoro, and releasing it stops it', async ({ page }) => {
    const pedal = page.getByTestId(PEDAL);
    const at = await centreOf(pedal);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(true);
    await expect(pedal).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(false);
    await expect(pedal).toHaveAttribute('aria-pressed', 'false');
    expect((await carm(page)).fluoroTimeSeconds).toBeGreaterThan(0);
    expect((await getSimState(page)).shotCount).toBe(0);
  });
});

test("while the pedal is held, a 'pointercancel' event on it stops fluoro", async ({ page }) => {
  await recordPedalEvents(page);
  const at = await centreOf(page.getByTestId(PEDAL));
  const touch = test.info().project.use.hasTouch;
  const screen = touch ? await touchScreen(page) : null;
  if (screen) await screen.down(PEDAL_FINGER, at);
  else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
  }
  await expect.poll(async () => (await carm(page)).fluoroOn).toBe(true);
  await page.waitForTimeout(200);
  await cancelPedalPointer(page);
  expect((await carm(page)).fluoroOn).toBe(false);
  await expect(page.getByTestId(PEDAL)).toHaveAttribute('aria-pressed', 'false');
  const stoppedAt = (await carm(page)).fluoroTimeSeconds;
  await page.waitForTimeout(400);
  expect((await carm(page)).fluoroTimeSeconds).toBe(stoppedAt);
  if (screen) await screen.close();
  else await page.mouse.up();
});

test('the pedal is visible without scrolling the page and at least 44×44 px', async ({ page }) => {
  const pedal = page.getByTestId(PEDAL);
  await expect(pedal).toBeVisible();
  await expect(pedal).toHaveText('Fluoro');
  const box = await pedal.boundingBox();
  const panel = await page.getByTestId('carm-panel').boundingBox();
  const viewport = page.viewportSize();
  if (!box || !panel || !viewport) throw new Error('missing box');
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(panel.x);
  expect(box.y).toBeGreaterThanOrEqual(panel.y);
  expect(box.x + box.width).toBeLessThanOrEqual(Math.min(viewport.width, panel.x + panel.width));
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(viewport.height, panel.y + panel.height));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
