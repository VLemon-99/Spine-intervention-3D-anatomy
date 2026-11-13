// F5-S6: the needle control pad with the mouse (F5.4). Desktop only; touch on
// the pad is tested in F5-S7.
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume, type NeedleDebug } from './needlePage';

async function needle(page: Page): Promise<NeedleDebug> {
  const n = await readNeedle(page);
  if (!n) throw new Error('no needle');
  return n;
}

async function padCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('needle-pad').boundingBox();
  if (!box) throw new Error('no pad');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, dx: number, dy: number): Promise<void> {
  const c = await padCentre(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('needle pad with the mouse', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await waitForVolume(page);
    await takeImage(page);
    expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  });

  test('dragging 50 px right raises yaw by 10°, 50 px up raises pitch by 10°', async ({ page }) => {
    await drag(page, 50, 0);
    let n = await needle(page);
    expect(Math.abs(n.hubAngles.yaw - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(n.hubAngles.pitch)).toBeLessThanOrEqual(1);
    await drag(page, 0, -50);
    n = await needle(page);
    expect(Math.abs(n.hubAngles.pitch - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(n.hubAngles.yaw - 10)).toBeLessThanOrEqual(1);
  });

  test('a long drag stops at 45°', async ({ page }) => {
    await drag(page, 400, -400);
    const n = await needle(page);
    expect(n.hubAngles.yaw).toBeCloseTo(45, 6);
    expect(n.hubAngles.pitch).toBeCloseTo(45, 6);
  });

  test('one wheel step up advances 1 mm, with Shift 0.2 mm; one step down withdraws 1 mm', async ({ page }) => {
    const c = await padCentre(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await needle(page)).insertedDepth).toBeCloseTo(1, 6);
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Shift');
    await expect.poll(async () => (await needle(page)).insertedDepth).toBeCloseTo(1.2, 6);
    await page.mouse.wheel(0, 100);
    await expect.poll(async () => (await needle(page)).insertedDepth).toBeCloseTo(0.2, 6);
  });

  test('the page does not scroll when the wheel is used over the pad', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { wheelSeen: boolean[] }).wheelSeen = [];
      window.addEventListener('wheel', (e) => (window as unknown as { wheelSeen: boolean[] }).wheelSeen.push(e.defaultPrevented));
    });
    const scrollBefore = await page.evaluate(() => [window.scrollX, window.scrollY]);
    const c = await padCentre(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, 300);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => page.evaluate(() => (window as unknown as { wheelSeen: boolean[] }).wheelSeen.length)).toBe(2);
    expect(await page.evaluate(() => (window as unknown as { wheelSeen: boolean[] }).wheelSeen)).toEqual([true, true]);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual(scrollBefore);
  });
});
