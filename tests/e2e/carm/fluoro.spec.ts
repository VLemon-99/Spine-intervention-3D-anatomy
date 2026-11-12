// F3-S7: continuous fluoro while the F key is held (F3.4). Desktop set-up only:
// the tablet has no keyboard; its on-screen pedal is tested in fluoroPedal.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas, type PixelPosition } from '../../fixtures/readCanvas';
import { getSimState } from '../../fixtures/simPage';

type CarmDebug = { fluoroTimeSeconds: number; fluoroOn: boolean };
const carm = (page: Page): Promise<CarmDebug> =>
  page.evaluate(() => (window as unknown as { __sim: { carm(): CarmDebug } }).__sim.carm());

const ZERO: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const MOVED: CArmPose = { ...ZERO, oblique: 20, tilt: 10 };
const MOVED_AGAIN: CArmPose = { ...ZERO, oblique: 35, tilt: 20 };

/** Projected vertebra block centres at the given poses, plus a fixed 8×8 grid of points. */
function points(...poses: CArmPose[]): PixelPosition[] {
  const blocks = [PHANTOM_TEST_POINTS.blockCentres.upper, PHANTOM_TEST_POINTS.blockCentres.lower];
  const projected = poses.flatMap((pose) => blocks.map((b) => createProjection(pose).project(b)));
  const grid: PixelPosition[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) grid.push({ x: 32 + i * 64, y: 32 + j * 64 });
  return [...projected, ...grid].filter((p) => p.x >= 0 && p.x < 512 && p.y >= 0 && p.y < 512);
}

const difference = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);

/** Wait until the image on screen is of `pose` (the renderer draws on the exposure), then two more frames. */
async function waitForImageOf(page: Page, pose: CArmPose): Promise<void> {
  await expect.poll(async () => (await getSimState(page)).lastImagePose).toEqual(pose);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** Move the C-arm with the pose keys: Shift+L steps oblique 5°, Shift+I steps tilt 5°. */
async function stepKeys(page: Page, obliqueSteps: number, tiltSteps: number): Promise<void> {
  for (let i = 0; i < obliqueSteps; i++) await page.keyboard.press('Shift+KeyL');
  for (let i = 0; i < tiltSteps; i++) await page.keyboard.press('Shift+KeyI');
}

test.describe('desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
  });

  test('while F is held, changing the pose changes the image without a Shot; after release it does not', async ({
    page,
  }) => {
    await acceptDisclaimer(page);
    const where = points(ZERO, MOVED, MOVED_AGAIN);

    await page.keyboard.down('f');
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(true);
    await waitForImageOf(page, ZERO);
    const atZero = await readCanvas(page, where);

    await stepKeys(page, 4, 2); // oblique 20, tilt 10
    expect((await getSimState(page)).pose).toEqual(MOVED);
    await waitForImageOf(page, MOVED);
    const atMoved = await readCanvas(page, where);
    expect(difference(atZero, atMoved)).toBeGreaterThan(100);
    expect((await getSimState(page)).shotCount).toBe(0);

    await page.keyboard.up('f');
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(false);
    const afterRelease = await readCanvas(page, where);

    await stepKeys(page, 3, 2); // oblique 35, tilt 20
    expect((await getSimState(page)).pose).toEqual(MOVED_AGAIN);
    await page.waitForTimeout(500);
    expect(await readCanvas(page, where)).toEqual(afterRelease);
    expect((await getSimState(page)).lastImagePose).toEqual(MOVED);
    expect((await getSimState(page)).shotCount).toBe(0);
  });

  test('holding F for about 3 s adds the time between keydown and keyup (as seen in the page)', async ({ page }) => {
    await acceptDisclaimer(page);
    await page.evaluate(() => {
      const w = window as unknown as { __fKeyTimes: { down?: number; up?: number } };
      w.__fKeyTimes = {};
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF' && !e.repeat && w.__fKeyTimes.down === undefined) w.__fKeyTimes.down = e.timeStamp;
      });
      window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyF') w.__fKeyTimes.up = e.timeStamp;
      });
    });
    await page.keyboard.down('f');
    await page.waitForTimeout(3000);
    await page.keyboard.up('f');
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(false);

    const times = await page.evaluate(
      () => (window as unknown as { __fKeyTimes: { down: number; up: number } }).__fKeyTimes,
    );
    const heldSeconds = (times.up - times.down) / 1000;
    expect(heldSeconds).toBeGreaterThan(2.5);
    const { fluoroTimeSeconds } = await carm(page);
    expect(Math.abs(fluoroTimeSeconds - heldSeconds)).toBeLessThanOrEqual(0.1 * heldSeconds);
    await expect(page.getByTestId('fluoro-time')).toHaveText(`${fluoroTimeSeconds.toFixed(1)} s`);
    expect((await getSimState(page)).shotCount).toBe(0);
  });

  test("while F is held, a window 'blur' event stops fluoro and the time stops growing", async ({ page }) => {
    await acceptDisclaimer(page);
    await page.keyboard.down('f');
    await expect.poll(async () => (await carm(page)).fluoroOn).toBe(true);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect((await carm(page)).fluoroOn).toBe(false);
    const stoppedAt = (await carm(page)).fluoroTimeSeconds;
    expect(stoppedAt).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    expect((await carm(page)).fluoroTimeSeconds).toBe(stoppedAt);
    expect((await carm(page)).fluoroOn).toBe(false);
    await page.keyboard.up('f');
  });

  test('F does nothing while the disclaimer is shown', async ({ page }) => {
    await expect(page.getByTestId('disclaimer')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.down('f');
    await page.waitForTimeout(300);
    expect(await carm(page)).toEqual({ fluoroTimeSeconds: 0, fluoroOn: false });
    await page.keyboard.up('f');
    const state = await getSimState(page);
    expect(state.lastImagePose).toBeNull();
    expect(state.shotCount).toBe(0);
  });
});
