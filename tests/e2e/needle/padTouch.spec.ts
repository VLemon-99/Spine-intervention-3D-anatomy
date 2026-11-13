// F5-S7: the needle control pad with touch (F5.5). Tablet only; the mouse on
// the pad is tested in F5-S6.
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume, type NeedleDebug } from './needlePage';
import { oneFingerDrag, twist, type Point } from './touch';

async function needle(page: Page): Promise<NeedleDebug> {
  const n = await readNeedle(page);
  if (!n) throw new Error('no needle');
  return n;
}

async function padCentre(page: Page): Promise<Point> {
  const box = await page.getByTestId('needle-pad').boundingBox();
  if (!box) throw new Error('no pad');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('needle pad with touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await waitForVolume(page);
    await takeImage(page);
    expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  });

  test('a 50 px one-finger drag to the right raises yaw by 10°', async ({ page }) => {
    const c = await padCentre(page);
    await oneFingerDrag(page, c, { x: c.x + 50, y: c.y });
    const n = await needle(page);
    expect(Math.abs(n.hubAngles.yaw - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(n.hubAngles.pitch)).toBeLessThanOrEqual(1);
  });

  test('a 45° clockwise twist turns the bevel +45°, counter-clockwise −45°', async ({ page }) => {
    const c = await padCentre(page);
    await twist(page, c, 20, 45);
    expect(Math.abs((await needle(page)).bevelAngle - 45)).toBeLessThanOrEqual(5);
    await twist(page, c, 20, -45);
    await twist(page, c, 20, -45);
    expect(Math.abs((await needle(page)).bevelAngle - 315)).toBeLessThanOrEqual(5);
    // The twist leaves the hub angles alone.
    const { hubAngles } = await needle(page);
    expect(Math.abs(hubAngles.pitch)).toBeLessThanOrEqual(1);
    expect(Math.abs(hubAngles.yaw)).toBeLessThanOrEqual(1);
  });

  test('touching the pad does not scroll the page', async ({ page }) => {
    // Make the page taller than the screen so a swipe could scroll it.
    await page.evaluate(() => {
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'visible';
      const spacer = document.createElement('div');
      spacer.style.height = '3000px';
      document.body.append(spacer);
    });
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    const before = await page.evaluate(() => [window.scrollX, window.scrollY]);
    const c = await padCentre(page);
    await oneFingerDrag(page, c, { x: c.x, y: c.y - 150 });
    await oneFingerDrag(page, c, { x: c.x - 150, y: c.y });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual(before);
  });
});
